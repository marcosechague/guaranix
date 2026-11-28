import {
  type SchemaDatabase,
  type ScopedTransaction,
  withBoxScope,
  withSystemScope,
} from '@guaranix/db';
import {
  boxes,
  charges,
  paymentAccounts,
  paymentAttempts,
  paymentCustomers,
  savedCards,
} from '@guaranix/db/schema';
import { type ChargeOutcome, type PaymentProvider, PaymentProviderError } from '@guaranix/payments';
import { calendarDateIn } from '@guaranix/shared';
import { and, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { renewAutopayPlans } from '../services/autopay-renewals';
import {
  abandonAttempt,
  AUTOPAY_MAX_ATTEMPTS,
  logPaymentEvent,
  type PaymentAttemptRow,
  settleAttempt,
} from '../services/card-attempts';
import {
  activePaymentAccount,
  type PaymentAccountRow,
  type PaymentRuntime,
  providerForAccount,
} from '../services/card-payment-runtime';
import { isUniqueViolation } from '../services/errors';
import { createPaymentLink, outstandingOf } from '../services/payment-links';
import type { PaymentNotifier } from '../services/payment-notifier';

/** An autopay call that never answered: after this, ask the processor what happened. */
const AUTOPAY_STALE_MS = 10 * 60 * 1000;
/** A member may still be on the link's payment form for a while. */
const LINK_STALE_MS = 60 * 60 * 1000;

export interface AutopayResult {
  boxes: number;
  renewed: number;
  attempted: number;
  approved: number;
  declined: number;
  /** No answer from the processor; settled on the next run. */
  unanswered: number;
  failedBoxIds: string[];
}

interface BoxTarget {
  boxId: string;
  timezone: string;
}

interface DueCharge {
  chargeId: string;
  memberId: string;
  description: string;
  savedCardId: string;
  cardRef: string;
  customerRef: string;
}

interface Run {
  database: SchemaDatabase;
  runtime: PaymentRuntime;
  notifier: PaymentNotifier;
  now: Date;
  result: AutopayResult;
}

const inBox = <T>(run: Run, boxId: string, work: (transaction: ScopedTransaction) => Promise<T>) =>
  withBoxScope(run.database, { boxId }, work);

/** Open charges of members with an active card, due today or earlier but not before they consented. */
async function dueCharges(transaction: ScopedTransaction, accountId: string, today: string) {
  return transaction
    .select({
      chargeId: charges.id,
      memberId: charges.memberId,
      description: charges.description,
      savedCardId: savedCards.id,
      cardRef: savedCards.cardRef,
      customerRef: paymentCustomers.customerRef,
    })
    .from(charges)
    .innerJoin(
      savedCards,
      and(
        eq(savedCards.memberId, charges.memberId),
        eq(savedCards.accountId, accountId),
        eq(savedCards.status, 'active'),
      ),
    )
    .innerJoin(paymentCustomers, eq(paymentCustomers.id, savedCards.customerId))
    .innerJoin(boxes, eq(boxes.id, charges.boxId))
    .where(
      and(
        eq(charges.status, 'open'),
        lte(charges.dueOn, today),
        // Consent covers what falls due from then on; older debts are paid by link or at the desk.
        gte(
          charges.dueOn,
          sql`(${savedCards.autopayConsentAt} at time zone ${boxes.timezone})::date`,
        ),
      ),
    );
}

/** The next try number for a charge, or null when it must not be tried today. */
function nextAttemptNumber(attempts: PaymentAttemptRow[], today: string, now: Date): number | null {
  const autopay = attempts.filter((attempt) => attempt.kind === 'autopay');
  if (autopay.some((attempt) => attempt.status === 'pending' || attempt.status === 'approved')) {
    return null;
  }
  const payingByLink = attempts.some(
    (attempt) =>
      attempt.kind === 'link' &&
      (attempt.status === 'approved' ||
        (attempt.status === 'pending' &&
          now.getTime() - attempt.createdAt.getTime() < LINK_STALE_MS)),
  );
  if (payingByLink) return null;
  const last = autopay.reduce<PaymentAttemptRow | null>(
    (latest, attempt) =>
      !latest || attempt.attemptNumber > latest.attemptNumber ? attempt : latest,
    null,
  );
  if (!last) return 1;
  if (last.attemptNumber >= AUTOPAY_MAX_ATTEMPTS) return null;
  if (!last.nextRetryOn || last.nextRetryOn > today) return null;
  return last.attemptNumber + 1;
}

/** Attempts whose answer never arrived: ask the processor, and settle them either way. */
async function reconcile(
  run: Run,
  target: BoxTarget,
  today: string,
  provider: PaymentProvider,
  stale: PaymentAttemptRow[],
) {
  for (const attempt of stale) {
    let status: Awaited<ReturnType<PaymentProvider['getPaymentStatus']>>;
    try {
      status = await provider.getPaymentStatus(attempt.orderNumber);
    } catch (error) {
      if (error instanceof PaymentProviderError) continue;
      throw error;
    }
    await inBox(run, target.boxId, async (transaction) => {
      const scope = { transaction, boxId: target.boxId, now: run.now, today };
      if (status.status === 'not_found') {
        await abandonAttempt(scope, attempt, 'no_answer');
      } else {
        await settleAttempt(scope, attempt.id, status);
      }
    });
  }
}

async function failureNotice(
  run: Run,
  target: BoxTarget,
  attempt: PaymentAttemptRow,
  transaction: ScopedTransaction,
) {
  const { charge, outstandingGs } = await outstandingOf(transaction, attempt.chargeId);
  if (outstandingGs === 0) return null;
  const link = await createPaymentLink(transaction, run.runtime, {
    boxId: target.boxId,
    chargeId: charge.id,
    now: run.now,
    createdByUserId: null,
  });
  return {
    boxId: target.boxId,
    memberId: charge.memberId,
    chargeId: charge.id,
    amountGs: outstandingGs,
    description: charge.description,
    linkUrl: link.url,
    linkExpiresAt: link.expiresAt,
    whatsappUrl: link.whatsappUrl,
    attemptNumber: attempt.attemptNumber,
    finalAttempt: attempt.nextRetryOn === null,
  };
}

/**
 * One automatic try: the attempt is committed first (its order number makes a
 * second charge of the same order impossible), then the processor is called
 * outside any transaction, then its answer is applied. A crash in between
 * leaves a pending attempt that the next run settles with `getPaymentStatus`.
 */
async function chargeOnce(
  run: Run,
  target: BoxTarget,
  account: PaymentAccountRow,
  provider: PaymentProvider,
  today: string,
  due: DueCharge,
) {
  const attempt = await inBox(run, target.boxId, async (transaction) => {
    const existing = await transaction
      .select()
      .from(paymentAttempts)
      .where(eq(paymentAttempts.chargeId, due.chargeId));
    const attemptNumber = nextAttemptNumber(existing, today, run.now);
    if (attemptNumber === null) return null;
    const { outstandingGs } = await outstandingOf(transaction, due.chargeId);
    if (outstandingGs === 0) return null;
    const [created] = await transaction
      .insert(paymentAttempts)
      .values({
        boxId: target.boxId,
        accountId: account.id,
        chargeId: due.chargeId,
        memberId: due.memberId,
        kind: 'autopay',
        savedCardId: due.savedCardId,
        attemptNumber,
        amountGs: outstandingGs,
        createdAt: run.now,
      })
      .returning();
    return created ?? null;
  }).catch((error: unknown) => {
    // Another run created this try first.
    if (isUniqueViolation(error)) return null;
    throw error;
  });
  if (!attempt) return;
  run.result.attempted += 1;

  let outcome: ChargeOutcome | PaymentProviderError;
  try {
    outcome = await provider.chargeCard({
      customerRef: due.customerRef,
      cardRef: due.cardRef,
      orderNumber: attempt.orderNumber,
      amountGs: attempt.amountGs,
      description: due.description,
    });
  } catch (error) {
    if (!(error instanceof PaymentProviderError)) throw error;
    if (error.code === 'unavailable') {
      run.result.unanswered += 1;
      return;
    }
    outcome = error;
  }

  const answer = outcome;
  const notice = await inBox(run, target.boxId, async (transaction) => {
    const scope = { transaction, boxId: target.boxId, now: run.now, today };
    await logPaymentEvent(transaction, {
      boxId: target.boxId,
      accountId: account.id,
      provider: account.provider,
      type: 'charge',
      orderNumber: attempt.orderNumber,
      signatureValid: true,
      outcome: 'processed',
      payload:
        answer instanceof PaymentProviderError
          ? { error: answer.code, detail: answer.detail ?? null }
          : { result: answer.status },
      createdAt: run.now,
    });
    if (answer instanceof PaymentProviderError) {
      await abandonAttempt(scope, attempt, answer.detail ?? answer.code);
      // Broken keys are the box's problem, not the member's: no message for them.
      if (answer.code === 'auth') return null;
    } else {
      const settled = await settleAttempt(scope, attempt.id, answer);
      if (settled.status === 'approved') {
        run.result.approved += 1;
        return null;
      }
    }
    run.result.declined += 1;
    const [current] = await transaction
      .select()
      .from(paymentAttempts)
      .where(eq(paymentAttempts.id, attempt.id));
    // First and last failure: enough to act on, without a message every other day.
    if (!current || (current.attemptNumber !== 1 && current.nextRetryOn !== null)) return null;
    return failureNotice(run, target, current, transaction);
  });
  if (notice) await run.notifier.paymentFailed(notice);
}

async function autopayBox(run: Run, target: BoxTarget) {
  const today = calendarDateIn(target.timezone, run.now);
  const prepared = await inBox(run, target.boxId, async (transaction) => {
    const account = await activePaymentAccount(transaction, run.runtime, target.boxId, run.now);
    if (!account?.autopayEnabled) return null;
    const renewed = await renewAutopayPlans(transaction, target.boxId, account.id, today);
    const stale = await transaction
      .select()
      .from(paymentAttempts)
      .where(and(eq(paymentAttempts.accountId, account.id), eq(paymentAttempts.status, 'pending')));
    return { account, renewed, stale };
  });
  if (!prepared) return;
  run.result.renewed += prepared.renewed;
  const provider = await providerForAccount(run.runtime, prepared.account);
  const stale = prepared.stale.filter(
    (attempt) =>
      run.now.getTime() - attempt.createdAt.getTime() >=
      (attempt.kind === 'autopay' ? AUTOPAY_STALE_MS : LINK_STALE_MS),
  );
  await reconcile(run, target, today, provider, stale);
  const due = await inBox(run, target.boxId, (transaction) =>
    dueCharges(transaction, prepared.account.id, today),
  );
  for (const charge of due) {
    await chargeOnce(run, target, prepared.account, provider, today, charge);
  }
}

/**
 * Daily card autopay for every box that turned it on: renew subscriptions,
 * settle tries that never got an answer, then charge what is due with the
 * retry schedule of `AUTOPAY_RETRY_GAPS_DAYS`. Each box runs on its own, so
 * one broken account never stops the rest.
 */
export async function runCardAutopay(
  database: SchemaDatabase,
  runtime: PaymentRuntime,
  notifier: PaymentNotifier,
  now: Date,
): Promise<AutopayResult> {
  // Unscoped only to list which boxes to visit; the work itself runs under RLS.
  const targets = await withSystemScope(database, (transaction) =>
    transaction
      .select({ boxId: boxes.id, timezone: boxes.timezone })
      .from(paymentAccounts)
      .innerJoin(boxes, eq(boxes.id, paymentAccounts.boxId))
      .where(
        and(
          isNull(paymentAccounts.disconnectedAt),
          eq(paymentAccounts.autopayEnabled, true),
          inArray(boxes.status, ['trial', 'active']),
        ),
      ),
  );
  const result: AutopayResult = {
    boxes: targets.length,
    renewed: 0,
    attempted: 0,
    approved: 0,
    declined: 0,
    unanswered: 0,
    failedBoxIds: [],
  };
  const run: Run = { database, runtime, notifier, now, result };
  for (const target of targets) {
    try {
      await autopayBox(run, target);
    } catch (error) {
      result.failedBoxIds.push(target.boxId);
      console.error('Card autopay failed', {
        boxId: target.boxId,
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
  }
  return result;
}
