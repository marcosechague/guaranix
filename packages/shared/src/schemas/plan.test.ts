import { describe, expect, it } from 'vitest';
import { createPlanSchema, planPauseSchema } from './plan';

const base = { name: 'Plan', durationDays: 30, priceGs: 300_000 };

describe('createPlanSchema', () => {
  it.each([
    { kind: 'unlimited' },
    { kind: 'weekly_limit', classesPerWeek: 3 },
    { kind: 'class_pack', classCount: 10 },
    { kind: 'drop_in', classCount: 1 },
  ] as const)('accepts a valid $kind plan', (limits) => {
    expect(createPlanSchema.safeParse({ ...base, ...limits }).success).toBe(true);
  });

  it.each([
    [{ kind: 'weekly_limit' }, 'classesPerWeek'],
    [{ kind: 'unlimited', classesPerWeek: 3 }, 'classesPerWeek'],
    [{ kind: 'unlimited', classCount: 10 }, 'classCount'],
    [{ kind: 'class_pack', classCount: 1 }, 'classCount'],
    [{ kind: 'drop_in', classCount: 5 }, 'classCount'],
  ] as const)('rejects %o on %s', (limits, path) => {
    const result = createPlanSchema.safeParse({ ...base, ...limits });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(path);
  });

  it('rejects fractional or negative guaraníes', () => {
    expect(
      createPlanSchema.safeParse({ ...base, kind: 'unlimited', priceGs: 300_000.5 }).success,
    ).toBe(false);
    expect(createPlanSchema.safeParse({ ...base, kind: 'unlimited', priceGs: -1 }).success).toBe(
      false,
    );
  });
});

describe('planPauseSchema', () => {
  const memberPlanId = '018f3c1e-7d2a-7c3b-9a1e-2b3c4d5e6f70';

  it('rejects a pause that ends before it starts', () => {
    const pause = { memberPlanId, startsOn: '2026-12-10', endsOn: '2026-12-01' };
    expect(planPauseSchema.safeParse(pause).success).toBe(false);
  });

  it('accepts a one-day pause', () => {
    const pause = { memberPlanId, startsOn: '2026-12-10', endsOn: '2026-12-10' };
    expect(planPauseSchema.safeParse(pause).success).toBe(true);
  });
});
