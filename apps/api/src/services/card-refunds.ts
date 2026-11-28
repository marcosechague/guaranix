import { paymentAttempts, payments } from '@guaranix/db/schema';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import { recordAudit } from './audit';
import { logPaymentEvent } from './card-attempts';
import {
  callPaymentProvider,
  findPaymentAccount,
  type PaymentRuntime,
  providerForAccount,
} from './card-payment-runtime';
import { reopenCharge } from './charges';
import { FRONT_DESK_ROLES, MANAGER_ROLES, assertRole, type ServiceContext } from './context';
import { conflict, notFound, unprocessable } from './errors';

/**
 * Gives a card payment back through the processor and opens its charge again.
 * Managers only. Bancard allows it until it closes the day; after that the
 * refund is made from Bancard's portal and this answers `refund_not_available`.
 */
export async function refundCardPayment(
  context: ServiceContext,
  runtime: PaymentRuntime,
  paymentId: string,
) {
  assertRole(context.auth.role, MANAGER_ROLES);
  const [payment] = await context.transaction
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .for('update');
  if (!payment) throw notFound('payment');
  if (payment.method !== 'card') throw unprocessable('refund_card_only');
  if (payment.status !== 'confirmed') throw conflict('payment_not_refundable');
  const [attempt] = await context.transaction
    .select()
    .from(paymentAttempts)
    .where(eq(paymentAttempts.paymentId, payment.id))
    .for('update');
  if (!attempt) throw notFound('payment_attempt');
  const account = await findPaymentAccount(context.transaction, context.auth.boxId);
  if (!account || account.id !== attempt.accountId) throw notFound('payment_account');

  const provider = await providerForAccount(runtime, account);
  await callPaymentProvider(() =>
    provider.refund({ orderNumber: attempt.orderNumber, amountGs: payment.amountGs }),
  );
  // From here the money is back with the member: the writes below only record it.
  await context.transaction
    .update(payments)
    .set({ status: 'refunded' })
    .where(eq(payments.id, payment.id));
  await context.transaction
    .update(paymentAttempts)
    .set({ status: 'refunded', resolvedAt: context.now })
    .where(eq(paymentAttempts.id, attempt.id));
  if (payment.chargeId) await reopenCharge(context, payment.chargeId);
  await logPaymentEvent(context.transaction, {
    boxId: context.auth.boxId,
    accountId: account.id,
    provider: account.provider,
    type: 'refund',
    orderNumber: attempt.orderNumber,
    signatureValid: true,
    outcome: 'processed',
    payload: { amountGs: payment.amountGs },
    createdAt: context.now,
  });
  await recordAudit(context, {
    action: 'payment.refunded',
    entityType: 'payment',
    entityId: payment.id,
    changes: { amountGs: payment.amountGs, orderNumber: attempt.orderNumber },
  });
  return { ...payment, status: 'refunded' as const };
}

/** Every try to charge a card, newest first: what was tried, when, and what the bank said. */
export async function listPaymentAttempts(
  context: ServiceContext,
  query: { chargeId?: string | undefined; memberId?: string | undefined },
) {
  assertRole(context.auth.role, FRONT_DESK_ROLES);
  const filters: SQL[] = [];
  if (query.chargeId) filters.push(eq(paymentAttempts.chargeId, query.chargeId));
  if (query.memberId) filters.push(eq(paymentAttempts.memberId, query.memberId));
  const rows = await context.transaction
    .select()
    .from(paymentAttempts)
    .where(and(...filters))
    .orderBy(desc(paymentAttempts.createdAt))
    .limit(200);
  return rows.map((row) => ({
    id: row.id,
    chargeId: row.chargeId,
    memberId: row.memberId,
    kind: row.kind,
    attemptNumber: row.attemptNumber,
    amountGs: row.amountGs,
    status: row.status,
    declineCode: row.declineCode,
    declineMessage: row.declineMessage,
    nextRetryOn: row.nextRetryOn,
    paymentId: row.paymentId,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  }));
}
