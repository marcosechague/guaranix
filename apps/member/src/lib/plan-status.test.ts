import type { MemberPlan } from '@guaranix/shared/api';
import { describe, expect, it } from 'vitest';
import { currentPlanHealth } from './plan-status';

const plan = (state: MemberPlan['state'], endsOn: string): MemberPlan => ({
  id: state,
  memberId: 'member',
  planId: 'plan',
  startsOn: '2026-11-01',
  endsOn,
  priceGs: 350_000,
  classesRemaining: null,
  state,
  pauses: [],
});

describe('currentPlanHealth', () => {
  it('prefers the active plan and counts the days left', () => {
    expect(
      currentPlanHealth(
        [plan('expired', '2026-10-31'), plan('active', '2026-12-15')],
        '2026-11-27',
      ),
    ).toMatchObject({ kind: 'ok', daysLeft: 18 });
  });

  it('warns when the plan ends within five days', () => {
    expect(currentPlanHealth([plan('active', '2026-11-30')], '2026-11-27')).toMatchObject({
      kind: 'expiring',
      daysLeft: 3,
    });
  });

  it('reports paused and missing plans', () => {
    expect(currentPlanHealth([plan('paused', '2026-12-30')], '2026-11-27').kind).toBe('paused');
    expect(currentPlanHealth([plan('expired', '2026-10-31')], '2026-11-27').kind).toBe('missing');
  });
});
