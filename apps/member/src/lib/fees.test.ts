import type { Charge, OwnAccount } from '@guaranix/shared/api';
import { describe, expect, it } from 'vitest';
import {
  feeState,
  inReviewGs,
  leftToPayGs,
  openCharges,
  payableGs,
  reportableCharges,
} from './fees';

const charge = (overrides: Partial<Charge>): Charge => ({
  id: 'c1',
  memberId: 'm1',
  memberPlanId: null,
  description: 'Cuota',
  amountGs: 300_000,
  dueOn: '2026-11-10',
  status: 'open',
  paidGs: 0,
  outstandingGs: 300_000,
  ...overrides,
});

const payment = (overrides: Partial<OwnAccount['payments'][number]>) => ({
  id: 'p1',
  memberId: 'm1',
  chargeId: 'c1',
  amountGs: 300_000,
  method: 'bank_transfer' as const,
  status: 'pending_review' as const,
  paidAt: '2026-11-11T12:00:00Z',
  reference: null,
  receiptFileKey: null,
  notes: null,
  ...overrides,
});

const account = (charges: Charge[], payments: OwnAccount['payments'] = []): OwnAccount => ({
  charges,
  payments,
  outstandingGs: charges.reduce((sum, item) => sum + item.outstandingGs, 0),
});

describe('fees', () => {
  const today = '2026-11-20';

  it('reads paid, in review, overdue and due', () => {
    const paid = charge({ status: 'paid', paidGs: 300_000, outstandingGs: 0 });
    expect(feeState(paid, account([paid]), today)).toEqual({ kind: 'paid' });
    const late = charge({});
    expect(feeState(late, account([late]), today)).toEqual({ kind: 'overdue' });
    expect(feeState(late, account([late], [payment({})]), today)).toEqual({ kind: 'in_review' });
    const rejected = account([late], [payment({ status: 'rejected' })]);
    expect(feeState(late, rejected, today)).toEqual({ kind: 'overdue' });
    const next = charge({ dueOn: '2026-12-01' });
    expect(feeState(next, account([next]), today)).toEqual({ kind: 'due', dueOn: '2026-12-01' });
    expect(feeState(next, account([next]), '2026-12-01')).toEqual({
      kind: 'due',
      dueOn: '2026-12-01',
    });
  });

  it('a partly paid fee is still due for what is left', () => {
    const partly = charge({ paidGs: 100_000, outstandingGs: 200_000 });
    expect(feeState(partly, account([partly]), today).kind).toBe('overdue');
  });

  it('lists open fees oldest first and nets what is waiting for review', () => {
    const december = charge({ id: 'c2', dueOn: '2026-12-10' });
    const november = charge({ id: 'c1', dueOn: '2026-11-10' });
    const voided = charge({ id: 'c3', status: 'void' });
    const state = account([december, november, voided], [payment({ amountGs: 300_000 })]);
    expect(openCharges(state).map((item) => item.id)).toEqual(['c1', 'c2']);
    expect(inReviewGs(state)).toBe(300_000);
    expect(leftToPayGs({ ...state, outstandingGs: 600_000 })).toBe(300_000);
    expect(leftToPayGs({ ...state, outstandingGs: 100_000 })).toBe(0);
  });

  it('offers only what is left after receipts waiting for review', () => {
    const partly = charge({ id: 'c1' });
    const other = charge({ id: 'c2', dueOn: '2026-12-10' });
    const state = account([partly, other], [payment({ chargeId: 'c1', amountGs: 100_000 })]);
    expect(payableGs(partly, state)).toBe(200_000);
    expect(reportableCharges(state).map((item) => item.id)).toEqual(['c1', 'c2']);
    const covered = account([partly], [payment({ chargeId: 'c1' })]);
    expect(reportableCharges(covered)).toEqual([]);
  });
});
