import { type SchemaDatabase, withBoxScope, withSystemScope } from '@guaranix/db';
import { boxes, paymentAccounts, paymentAttempts } from '@guaranix/db/schema';
import {
  type PaymentWebhookEvent,
  PaymentProviderError,
  type WebhookRequest,
} from '@guaranix/payments';
import { calendarDateIn, idSchema } from '@guaranix/shared';
import { eq } from 'drizzle-orm';
import { logPaymentEvent, settleAttempt } from './card-attempts';
import { reverseDuplicatePayment } from './card-duplicates';
import { type PaymentRuntime, providerForAccount } from './card-payment-runtime';

export interface WebhookResponse {
  status: 200 | 401 | 404 | 503;
  body: Record<string, unknown>;
}

const REJECTED = { status: 'error' } as const;

/**
 * A confirmation from a box's processor. The account id in the URL says whose
 * key must have signed it; the signature is checked before anything is read.
 * Every call is logged, a repeated event is acknowledged without being applied
 * twice, and the attempt row is locked so two copies arriving together can't
 * both record the payment.
 */
export async function processPaymentWebhook(
  database: SchemaDatabase,
  runtime: PaymentRuntime,
  accountId: string,
  request: WebhookRequest,
  now: Date,
): Promise<WebhookResponse> {
  if (!idSchema.safeParse(accountId).success) return { status: 404, body: REJECTED };
  const [found] = await withSystemScope(database, (transaction) =>
    transaction
      .select({ account: paymentAccounts, timezone: boxes.timezone })
      .from(paymentAccounts)
      .innerJoin(boxes, eq(boxes.id, paymentAccounts.boxId))
      .where(eq(paymentAccounts.id, accountId)),
  );
  if (!found) return { status: 404, body: REJECTED };
  const { account, timezone } = found;
  const boxId = account.boxId;
  const provider = await providerForAccount(runtime, account);

  let event: PaymentWebhookEvent;
  try {
    event = await provider.parseWebhook(request);
  } catch (error) {
    if (!(error instanceof PaymentProviderError)) throw error;
    await withBoxScope(database, { boxId }, (transaction) =>
      logPaymentEvent(transaction, {
        boxId,
        accountId,
        provider: account.provider,
        type: 'webhook',
        signatureValid: false,
        outcome: 'rejected',
        payload: { reason: error.detail ?? error.code },
        createdAt: now,
      }),
    );
    // Unavailable: we could not double-check with the processor; a 503 makes it send again.
    const status =
      error.code === 'invalid_signature' ? 401 : error.code === 'unavailable' ? 503 : 200;
    return { status, body: REJECTED };
  }

  const settled = await withBoxScope(database, { boxId }, async (transaction) => {
    const [attempt] = await transaction
      .select()
      .from(paymentAttempts)
      .where(eq(paymentAttempts.orderNumber, event.orderNumber))
      .for('update');
    const base = {
      boxId,
      accountId,
      provider: account.provider,
      type: 'webhook',
      orderNumber: event.orderNumber,
      signatureValid: true,
      payload: { ...event.summary, result: event.outcome.status },
      createdAt: now,
    };
    if (!attempt || attempt.accountId !== accountId) {
      await logPaymentEvent(transaction, { ...base, outcome: 'ignored' });
      return null;
    }
    const first = await logPaymentEvent(transaction, {
      ...base,
      eventKey: event.eventKey,
      outcome: 'processed',
    });
    if (!first) {
      await logPaymentEvent(transaction, { ...base, outcome: 'duplicate' });
      return null;
    }
    return settleAttempt(
      { transaction, boxId, now, today: calendarDateIn(timezone, now) },
      attempt.id,
      event.outcome,
    );
  });
  if (settled?.duplicate) await reverseDuplicatePayment(database, runtime, account, settled, now);
  return { status: 200, body: provider.webhookAcknowledgement() };
}
