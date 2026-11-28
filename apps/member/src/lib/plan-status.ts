import { daysBetween } from '@guaranix/shared';
import type { MemberPlan } from '@guaranix/shared/api';

export type PlanHealth =
  | { kind: 'ok'; plan: MemberPlan; daysLeft: number }
  | { kind: 'expiring'; plan: MemberPlan; daysLeft: number }
  | { kind: 'paused'; plan: MemberPlan; daysLeft: number }
  | { kind: 'missing' };

const EXPIRING_SOON_DAYS = 5;

/** The plan that matters today: the active one, else a paused one, else nothing. */
export function currentPlanHealth(plans: readonly MemberPlan[], today: string): PlanHealth {
  const active = plans.find((plan) => plan.state === 'active');
  const paused = plans.find((plan) => plan.state === 'paused');
  const plan = active ?? paused;
  if (!plan) return { kind: 'missing' };
  const daysLeft = Math.max(daysBetween(today, plan.endsOn), 0);
  if (plan.state === 'paused') return { kind: 'paused', plan, daysLeft };
  if (daysLeft <= EXPIRING_SOON_DAYS) return { kind: 'expiring', plan, daysLeft };
  return { kind: 'ok', plan, daysLeft };
}
