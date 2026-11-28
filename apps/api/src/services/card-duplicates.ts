import { type SchemaDatabase, withBoxScope } from '@guaranix/db';
import { paymentAttempts, payments } from '@guaranix/db/schema';
import { PaymentProviderError } from '@guaranix/payments';
import { eq } from 'drizzle-orm';
import { recordSystemAudit } from './audit';
import { logPaymentEvent, type SettledAttempt } from './card-attempts';
import {
  type PaymentAccountRow,
  type PaymentRuntime,
  providerForAccount,
} from './card-payment-runtime';

/**
 * A card approval landed on a charge someone had already paid (two payments
 * racing, a late answer). The member must not pay twice, so the second one is
 * given back right away. If the processor no longer allows it, the audit
 * says so for staff to refund it from the processor's portal.
 */
export async function reverseDuplicatePayment(
  database: SchemaDatabase,
  runtime: PaymentRuntime,
  account: PaymentAccountRow,
  attempt: SettledAttempt,
  now: Date,
): Promise<void> {
  if (!attempt.duplicate || !attempt.paymentId) return;
  const paymentId = attempt.paymentId;
  const provider = await providerForAccount(runtime, account);
  let failure: string | null = null;
  try {
    await provider.refund({ orderNumber: attempt.orderNumber, amountGs: attempt.amountGs });
  } catch (error) {
    if (!(error instanceof PaymentProviderError)) throw error;
    failure = error.detail ?? error.code;
  }
  await withBoxScope(database, { boxId: account.boxId }, async (transaction) => {
    if (failure === null) {
      await transaction
        .update(payments)
        .set({ status: 'refunded' })
        .where(eq(payments.id, paymentId));
      await transaction
        .update(paymentAttempts)
        .set({ status: 'refunded', resolvedAt: now })
        .where(eq(paymentAttempts.id, attempt.id));
    }
    await logPaymentEvent(transaction, {
      boxId: account.boxId,
      accountId: account.id,
      provider: account.provider,
      type: 'refund',
      orderNumber: attempt.orderNumber,
      signatureValid: true,
      outcome: failure === null ? 'processed' : 'rejected',
      payload: { reason: 'duplicate', ...(failure !== null && { error: failure }) },
      createdAt: now,
    });
    await recordSystemAudit(transaction, account.boxId, {
      action:
        failure === null
          ? 'payment.card_duplicate_refunded'
          : 'payment.card_duplicate_needs_refund',
      entityType: 'payment',
      entityId: paymentId,
      changes: { orderNumber: attempt.orderNumber, amountGs: attempt.amountGs },
    });
  });
}
