import { planLimitIssues } from '../schemas/plan';
import type { BoxSetup, SetupPlan, SetupSlot } from './setup';

/**
 * Problems found before saving a box's setup. `error` blocks saving (the
 * timetable cannot work); `warning` is probably a typo the owner confirms
 * (an extra zero, a 4 AM class). Codes are i18n keys under `onboarding.issues`.
 */
export interface SetupIssue {
  severity: 'error' | 'warning';
  code: SetupIssueCode;
  /** Where to point in the form, e.g. `slots.3` or `plans.0`. */
  path: string;
  params?: Record<string, string | number>;
}

export const SETUP_ISSUE_CODES = [
  'programs_name_repeated',
  'slots_empty',
  'slot_unknown_program',
  'slot_ends_after_midnight',
  'slot_duration_invalid',
  'slot_capacity_invalid',
  'slot_repeated',
  'slot_overlap',
  'slot_unusual_hour',
  'plans_empty',
  'plan_name_repeated',
  'plan_limits_invalid',
  'plan_unknown_program',
  'plan_price_zero',
  'plan_price_low',
  'plan_price_high',
  'plan_price_not_round',
  'plan_drop_in_above_monthly',
  'plan_weekly_above_unlimited',
  'plan_pack_above_drop_in',
] as const;

export type SetupIssueCode = (typeof SETUP_ISSUE_CODES)[number];

const MIN_DURATION = 15;
const MAX_DURATION = 240;
const MAX_CAPACITY = 200;
const EARLIEST_USUAL_MINUTE = 5 * 60;
const LATEST_USUAL_END_MINUTE = 23 * 60;
const MONTHLY_FLOOR_GS = 50_000;
const DROP_IN_FLOOR_GS = 10_000;
const PRICE_CEILING_GS = 3_000_000;

export const minutesOf = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const isMonthly = (plan: SetupPlan) =>
  (plan.kind === 'unlimited' || plan.kind === 'weekly_limit') && plan.durationDays >= 28;

function repeatedNames(names: string[]): number[] {
  const seen = new Set<string>();
  return names.flatMap((name, index) => {
    const key = name.trim().toLocaleLowerCase('es');
    if (seen.has(key)) return [index];
    seen.add(key);
    return [];
  });
}

function reviewSlot(slot: SetupSlot, path: string, programKeys: Set<string>): SetupIssue[] {
  const issues: SetupIssue[] = [];
  const start = minutesOf(slot.startTime);
  const end = start + slot.durationMinutes;
  if (!programKeys.has(slot.programKey)) {
    issues.push({ severity: 'error', code: 'slot_unknown_program', path });
  }
  if (slot.durationMinutes < MIN_DURATION || slot.durationMinutes > MAX_DURATION) {
    issues.push({
      severity: 'error',
      code: 'slot_duration_invalid',
      path,
      params: { min: MIN_DURATION, max: MAX_DURATION },
    });
  } else if (end > 24 * 60) {
    issues.push({ severity: 'error', code: 'slot_ends_after_midnight', path });
  }
  if (slot.capacity > MAX_CAPACITY) {
    issues.push({
      severity: 'error',
      code: 'slot_capacity_invalid',
      path,
      params: { max: MAX_CAPACITY },
    });
  }
  const blocked = issues.length > 0;
  if (!blocked && (start < EARLIEST_USUAL_MINUTE || end > LATEST_USUAL_END_MINUTE)) {
    issues.push({
      severity: 'warning',
      code: 'slot_unusual_hour',
      path,
      params: { time: slot.startTime },
    });
  }
  return issues;
}

/** Same program, same weekday: an identical start is an error, a partial overlap a warning. */
function reviewSlotPairs(slots: SetupSlot[]): SetupIssue[] {
  const issues: SetupIssue[] = [];
  slots.forEach((slot, index) => {
    for (let other = 0; other < index; other += 1) {
      const earlier = slots[other];
      if (!earlier || earlier.programKey !== slot.programKey) continue;
      if (!slot.weekdays.some((weekday) => earlier.weekdays.includes(weekday))) continue;
      const path = `slots.${index}`;
      const [aStart, bStart] = [minutesOf(earlier.startTime), minutesOf(slot.startTime)];
      if (aStart === bStart) {
        issues.push({
          severity: 'error',
          code: 'slot_repeated',
          path,
          params: { time: slot.startTime },
        });
      } else if (
        aStart < bStart + slot.durationMinutes &&
        bStart < aStart + earlier.durationMinutes
      ) {
        issues.push({
          severity: 'warning',
          code: 'slot_overlap',
          path,
          params: { time: slot.startTime, other: earlier.startTime },
        });
      }
    }
  });
  return issues;
}

function reviewPlanPrice(plan: SetupPlan, path: string): SetupIssue[] {
  const price = plan.priceGs;
  if (price === 0) return [{ severity: 'warning', code: 'plan_price_zero', path }];
  const issues: SetupIssue[] = [];
  const floor = plan.kind === 'drop_in' ? DROP_IN_FLOOR_GS : isMonthly(plan) ? MONTHLY_FLOOR_GS : 0;
  if (price < floor)
    issues.push({ severity: 'warning', code: 'plan_price_low', path, params: { price } });
  if (price > PRICE_CEILING_GS) {
    issues.push({ severity: 'warning', code: 'plan_price_high', path, params: { price } });
  }
  if (price % 1000 !== 0) {
    issues.push({ severity: 'warning', code: 'plan_price_not_round', path, params: { price } });
  }
  return issues;
}

/** Prices that contradict each other, like a single class costing more than a month. */
function reviewPlanLadder(plans: SetupPlan[]): SetupIssue[] {
  const issues: SetupIssue[] = [];
  const paid = plans.map((plan, index) => ({ plan, index })).filter(({ plan }) => plan.priceGs > 0);
  const cheapestMonthly = Math.min(
    ...paid.filter(({ plan }) => isMonthly(plan)).map(({ plan }) => plan.priceGs),
  );
  const unlimited = paid.filter(
    ({ plan }) => plan.kind === 'unlimited' && (plan.programKeys ?? []).length === 0,
  );
  const fullUnlimitedPrice = Math.min(...unlimited.map(({ plan }) => plan.priceGs));
  const dropIn = Math.min(
    ...paid.filter(({ plan }) => plan.kind === 'drop_in').map(({ plan }) => plan.priceGs),
  );
  for (const { plan, index } of paid) {
    const path = `plans.${index}`;
    if (plan.kind === 'drop_in' && plan.priceGs >= cheapestMonthly) {
      issues.push({ severity: 'warning', code: 'plan_drop_in_above_monthly', path });
    }
    if (plan.kind === 'weekly_limit' && plan.priceGs > fullUnlimitedPrice) {
      issues.push({ severity: 'warning', code: 'plan_weekly_above_unlimited', path });
    }
    if (plan.kind === 'class_pack' && plan.classCount && plan.priceGs / plan.classCount > dropIn) {
      issues.push({ severity: 'warning', code: 'plan_pack_above_drop_in', path });
    }
  }
  return issues;
}

function reviewPlan(plan: SetupPlan, path: string, programKeys: Set<string>): SetupIssue[] {
  const issues: SetupIssue[] = [];
  const limits = planLimitIssues({
    kind: plan.kind,
    classesPerWeek: plan.classesPerWeek ?? null,
    classCount: plan.classCount ?? null,
  });
  if (limits.length > 0) issues.push({ severity: 'error', code: 'plan_limits_invalid', path });
  if ((plan.programKeys ?? []).some((key) => !programKeys.has(key))) {
    issues.push({ severity: 'error', code: 'plan_unknown_program', path });
  }
  return [...issues, ...reviewPlanPrice(plan, path)];
}

export function reviewBoxSetup(setup: BoxSetup): SetupIssue[] {
  const programKeys = new Set(setup.programs.map((program) => program.key));
  const issues: SetupIssue[] = [
    ...repeatedNames(setup.programs.map((program) => program.name)).map((index) => ({
      severity: 'error' as const,
      code: 'programs_name_repeated' as const,
      path: `programs.${index}`,
    })),
    ...(setup.slots.length === 0
      ? [{ severity: 'error' as const, code: 'slots_empty' as const, path: 'slots' }]
      : []),
    ...setup.slots.flatMap((slot, index) => reviewSlot(slot, `slots.${index}`, programKeys)),
    ...reviewSlotPairs(setup.slots),
    ...(setup.plans.length === 0
      ? [{ severity: 'error' as const, code: 'plans_empty' as const, path: 'plans' }]
      : []),
    ...repeatedNames(setup.plans.map((plan) => plan.name)).map((index) => ({
      severity: 'error' as const,
      code: 'plan_name_repeated' as const,
      path: `plans.${index}`,
    })),
    ...setup.plans.flatMap((plan, index) => reviewPlan(plan, `plans.${index}`, programKeys)),
    ...reviewPlanLadder(setup.plans),
  ];
  return issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
}

export const blockingIssues = (issues: SetupIssue[]) =>
  issues.filter((issue) => issue.severity === 'error');
