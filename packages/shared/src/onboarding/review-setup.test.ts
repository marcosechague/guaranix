import { describe, expect, it } from 'vitest';
import { BUSINESS_TYPES } from '../domain/enums';
import { blockingIssues, reviewBoxSetup } from './review-setup';
import { type BoxSetup, boxSetupSchema } from './setup';
import { BOX_TEMPLATES } from './templates';

const base = (): BoxSetup => structuredClone(BOX_TEMPLATES.functional_box);

const codes = (setup: BoxSetup) =>
  reviewBoxSetup(setup).map((issue) => `${issue.severity}:${issue.code}:${issue.path}`);

const slot = (startTime: string, durationMinutes = 60, weekdays = [1]) => ({
  programKey: 'crossfit',
  startTime,
  weekdays,
  durationMinutes,
  capacity: 16,
});

describe('box templates', () => {
  it.each(BUSINESS_TYPES)('%s is valid and has nothing to warn about', (type) => {
    expect(boxSetupSchema.safeParse(BOX_TEMPLATES[type]).success).toBe(true);
    expect(reviewBoxSetup(BOX_TEMPLATES[type])).toEqual([]);
  });

  it('offers the usual 6/7/8 and 18/19/20 weekday classes for a functional box', () => {
    const weekday = BOX_TEMPLATES.functional_box.slots
      .filter((entry) => entry.programKey === 'crossfit' && entry.weekdays.includes(1))
      .map((entry) => entry.startTime);
    expect(weekday).toEqual(['06:00', '07:00', '08:00', '18:00', '19:00', '20:00']);
  });
});

describe('reviewBoxSetup: timetable', () => {
  it('blocks classes that cannot happen', () => {
    const setup = base();
    setup.slots = [slot('23:30'), slot('10:00', 5), slot('11:00', 60), slot('11:00', 60)];
    setup.slots.push({ ...slot('12:00'), programKey: 'yoga' });
    setup.slots.push({ ...slot('13:00'), capacity: 500 });
    expect(blockingIssues(reviewBoxSetup(setup)).map((issue) => issue.code)).toEqual([
      'slot_ends_after_midnight',
      'slot_duration_invalid',
      'slot_unknown_program',
      'slot_capacity_invalid',
      'slot_repeated',
    ]);
  });

  it('needs at least one class', () => {
    const setup = base();
    setup.slots = [];
    expect(codes(setup)).toContain('error:slots_empty:slots');
  });

  it('warns about overlapping classes and odd hours, only on shared weekdays', () => {
    const setup = base();
    setup.slots = [slot('18:00', 90), slot('19:00', 60), slot('04:00'), slot('18:30', 60, [2])];
    expect(codes(setup)).toEqual([
      'warning:slot_unusual_hour:slots.2',
      'warning:slot_overlap:slots.1',
    ]);
  });

  it('lets two programs share a time', () => {
    const setup = base();
    setup.slots = [slot('18:00'), { ...slot('18:00'), programKey: 'openBox' }];
    expect(codes(setup)).toEqual([]);
  });
});

describe('reviewBoxSetup: prices', () => {
  const withPlan = (changes: Partial<BoxSetup['plans'][number]>, index = 0) => {
    const setup = base();
    const plan = setup.plans[index];
    if (!plan) throw new Error(`No plan at ${index}`);
    setup.plans[index] = { ...plan, ...changes };
    return codes(setup);
  };

  it('catches a missing or extra zero', () => {
    expect(withPlan({ priceGs: 35_000 })).toContain('warning:plan_price_low:plans.0');
    expect(withPlan({ priceGs: 3_500_000 })).toContain('warning:plan_price_high:plans.0');
    expect(withPlan({ priceGs: 5_000 }, 4)).toContain('warning:plan_price_low:plans.4');
  });

  it('warns about free plans and prices that are not round', () => {
    expect(withPlan({ priceGs: 0 })).toEqual(['warning:plan_price_zero:plans.0']);
    expect(withPlan({ priceGs: 349_500 })).toEqual(['warning:plan_price_not_round:plans.0']);
  });

  it('warns when the prices contradict each other', () => {
    expect(withPlan({ priceGs: 400_000 }, 4)).toContain(
      'warning:plan_drop_in_above_monthly:plans.4',
    );
    expect(withPlan({ priceGs: 380_000 }, 1)).toContain(
      'warning:plan_weekly_above_unlimited:plans.1',
    );
    expect(withPlan({ priceGs: 600_000 }, 3)).toContain('warning:plan_pack_above_drop_in:plans.3');
  });

  it('blocks plans whose limits do not match their kind or name a missing program', () => {
    expect(withPlan({ classesPerWeek: null }, 1)).toContain('error:plan_limits_invalid:plans.1');
    expect(withPlan({ programKeys: ['yoga'] })).toContain('error:plan_unknown_program:plans.0');
    expect(withPlan({ name: 'ilimitado ' }, 1)).toContain('error:plan_name_repeated:plans.1');
  });

  it('lists errors before warnings', () => {
    const setup = base();
    setup.plans = [];
    setup.slots = [slot('04:00')];
    expect(codes(setup)).toEqual(['error:plans_empty:plans', 'warning:slot_unusual_hour:slots.0']);
  });
});
