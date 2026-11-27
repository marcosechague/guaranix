import { describe, expect, it } from 'vitest';
import { memberPlanStateOn } from './member-plan-state';

const plan = { status: 'active' as const, startsOn: '2026-11-01', endsOn: '2026-11-30' };
const pause = { startsOn: '2026-11-10', endsOn: '2026-11-15' };

describe('memberPlanStateOn', () => {
  it.each([
    ['2026-10-31', 'upcoming'],
    ['2026-11-01', 'active'],
    ['2026-11-10', 'paused'],
    ['2026-11-15', 'paused'],
    ['2026-11-16', 'active'],
    ['2026-11-30', 'active'],
    ['2026-12-01', 'expired'],
  ])('on %s is %s', (date, state) => {
    expect(memberPlanStateOn(plan, [pause], date)).toBe(state);
  });

  it('respects stored statuses', () => {
    expect(memberPlanStateOn({ ...plan, status: 'cancelled' }, [], '2026-11-05')).toBe('cancelled');
    expect(memberPlanStateOn({ ...plan, status: 'expired' }, [], '2026-11-05')).toBe('expired');
  });
});
