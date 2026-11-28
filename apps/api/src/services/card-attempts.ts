import type { ScopedTransaction } from '@guaranix/db';
import { charges, paymentAttempts, paymentEvents, payments } from '@guaranix/db/schema';
import type { ChargeOutcome } from '@guaranix/payments';
import { addDays } from '@guaranix/shared';
import { and, eq } from 'drizzle-orm';
import { recordSystemAudit } from './audit';
import { settleCharge } from './charges';
import { notFound } from './errors';

export type PaymentAttemptRow = typeof paymentAttempts.$inferSelect;

/**
 * Days to wait after each declined automatic try: the 1st try is on the due
 * date, then 1, 3 and 7 days after it. Four tries in a week, then the member
 * pays by link or at the front desk.
 */
export const AUTOPAY_RETRY_GAPS_DAYS = [1, 2, 4] as const;
export const AUTOPAY_MAX_ATTEMPTS = AUTOPAY_RETRY_GAPS_DAYS.length + 1;

/** Day of the next automatic try after try `attemptNumber` failed; null when there is none. */
export function nextRetryOn(today: string, attemptNumber: number): string | null {
  const gap = AUTOPAY_RETRY_GAPS_DAYS[attemptNumber - 1];
  return gap === undefined ? null : addDays(today, gap);
}

/** States in which the processor may still turn out to have taken the money. */
const UNSETTLED = new Set<PaymentAttemptRow['status']>(['pending', 'failed', 'declined']);

export interface SettleScope {
  transaction: ScopedTransaction;
  boxId: string;
  now: Date;
  /** The box's calendar day, for the retry date. */
  today: string;
}

export async function logPaymentEvent(
  transaction: ScopedTransaction,
  event: typeof paymentEvents.$inferInsert,
): Promise<boolean> {
  const inserted = await transaction
    .insert(paymentEvents)
    .values(event)
    .onConflictDoNothing()
    .returning({ id: paymentEvents.id });
  return inserted.length > 0;
}

async function approve(
  scope: SettleScope,
  attempt: PaymentAttemptRow,
  outcome: Extract<ChargeOutcome, { status: 'approved' }>,
): Promise<PaymentAttemptRow> {
  const { transaction, boxId, now } = scope;
  const [charge] = await transaction.select().from(charges).where(eq(charges.id, attempt.chargeId));
  if (!charge) throw notFound('charge');
  // The money is taken whatever happened meanwhile, so it is always recorded;
  // the audit flags when it did not match what was owed, for staff to refund.
  const [payment] = await transaction
    .insert(payments)
    .values({
      boxId,
      memberId: attempt.memberId,
      chargeId: attempt.chargeId,
      amountGs: outcome.amountGs,
      method: 'card',
      status: 'confirmed',
      paidAt: now,
      reference: outcome.providerReference ?? String(attempt.orderNumber),
      reviewedAt: now,
    })
    .returning();
  if (!payment) throw new Error('Card payment insert returned no row');
  const [approved] = await transaction
    .update(paymentAttempts)
    .set({
      status: 'approved',
      paymentId: payment.id,
      authorizationCode: outcome.authorizationCode,
      providerReference: outcome.providerReference,
      declineCode: null,
      declineMessage: null,
      nextRetryOn: null,
      resolvedAt: now,
    })
    .where(eq(paymentAttempts.id, attempt.id))
    .returning();
  if (!approved) throw notFound('payment_attempt');
  await settleCharge({ transaction }, charge.id);
  await recordSystemAudit(transaction, boxId, {
    action: 'payment.card_approved',
    entityType: 'payment',
    entityId: payment.id,
    changes: {
      memberId: attempt.memberId,
      chargeId: charge.id,
      amountGs: outcome.amountGs,
      kind: attempt.kind,
      orderNumber: attempt.orderNumber,
      ...(outcome.amountGs !== attempt.amountGs && { expectedGs: attempt.amountGs }),
      ...(charge.status !== 'open' && { chargeWasAlready: charge.status }),
    },
  });
  return approved;
}

/**
 * Applies what the processor answered to an attempt, from the charge call,
 * a webhook or a status check. Idempotent: an attempt is approved once, and a
 * late approval of an attempt we had given up on is still recorded, because
 * the member's money was taken.
 */
export async function settleAttempt(
  scope: SettleScope,
  attemptId: string,
  outcome: ChargeOutcome,
): Promise<PaymentAttemptRow> {
  const [attempt] = await scope.transaction
    .select()
    .from(paymentAttempts)
    .where(eq(paymentAttempts.id, attemptId))
    .for('update');
  if (!attempt) throw notFound('payment_attempt');
  if (!UNSETTLED.has(attempt.status)) return attempt;
  if (outcome.status === 'approved') return approve(scope, attempt, outcome);
  if (attempt.status !== 'pending') return attempt;
  const [declined] = await scope.transaction
    .update(paymentAttempts)
    .set({
      status: 'declined',
      declineCode: outcome.declineCode,
      declineMessage: outcome.declineMessage?.slice(0, 200) ?? null,
      nextRetryOn:
        attempt.kind === 'autopay' ? nextRetryOn(scope.today, attempt.attemptNumber) : null,
      resolvedAt: scope.now,
    })
    .where(eq(paymentAttempts.id, attempt.id))
    .returning();
  if (!declined) throw notFound('payment_attempt');
  return declined;
}

/**
 * The processor never answered and has no record of the order, so no money
 * moved. The try counts, and the next one waits a day.
 */
export async function abandonAttempt(
  scope: SettleScope,
  attempt: Pick<PaymentAttemptRow, 'id' | 'kind' | 'attemptNumber'>,
  reason: string,
): Promise<void> {
  const retries = attempt.kind === 'autopay' && attempt.attemptNumber < AUTOPAY_MAX_ATTEMPTS;
  await scope.transaction
    .update(paymentAttempts)
    .set({
      status: 'failed',
      declineCode: reason,
      nextRetryOn: retries ? addDays(scope.today, 1) : null,
      resolvedAt: scope.now,
    })
    .where(and(eq(paymentAttempts.id, attempt.id), eq(paymentAttempts.status, 'pending')));
}
