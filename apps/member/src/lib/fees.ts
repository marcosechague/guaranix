import type { Charge, OwnAccount } from '@guaranix/shared/api';

export type FeeState =
  { kind: 'paid' } | { kind: 'in_review' } | { kind: 'overdue' } | { kind: 'due'; dueOn: string };

/**
 * How a fee reads to the member: paid, waiting for the front desk to check a
 * receipt they sent, overdue, or due on a date. A partly paid fee is still due.
 */
export function feeState(charge: Charge, account: OwnAccount, today: string): FeeState {
  if (charge.status === 'paid' || charge.outstandingGs === 0) return { kind: 'paid' };
  const inReview = account.payments.some(
    (payment) => payment.chargeId === charge.id && payment.status === 'pending_review',
  );
  if (inReview) return { kind: 'in_review' };
  return charge.dueOn < today ? { kind: 'overdue' } : { kind: 'due', dueOn: charge.dueOn };
}

/** Fees still owed, oldest first: the one to pay first comes first. */
export function openCharges(account: OwnAccount): Charge[] {
  return account.charges
    .filter((charge) => charge.status === 'open' && charge.outstandingGs > 0)
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

/** Guaraníes the member already reported and the front desk hasn't checked yet. */
export function inReviewGs(account: OwnAccount): number {
  return account.payments
    .filter((payment) => payment.status === 'pending_review')
    .reduce((total, payment) => total + payment.amountGs, 0);
}

/** Owed beyond what is already waiting for review: what is left to pay now. */
export function leftToPayGs(account: OwnAccount): number {
  return Math.max(account.outstandingGs - inReviewGs(account), 0);
}
