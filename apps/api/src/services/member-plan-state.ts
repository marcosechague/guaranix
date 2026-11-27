import type { MemberPlanStatus } from '@guaranix/shared/domain';

export type MemberPlanState = 'upcoming' | 'active' | 'paused' | 'expired' | 'cancelled';

interface PlanDates {
  status: MemberPlanStatus;
  startsOn: string;
  endsOn: string;
}

interface PauseDates {
  startsOn: string;
  endsOn: string;
}

/**
 * What a member plan means on a given day. Pauses are stored as date ranges
 * and evaluated here, so no cron has to flip a status when a pause starts or ends.
 */
export function memberPlanStateOn(
  plan: PlanDates,
  pauses: readonly PauseDates[],
  date: string,
): MemberPlanState {
  if (plan.status === 'cancelled') return 'cancelled';
  if (plan.status === 'expired' || date > plan.endsOn) return 'expired';
  if (date < plan.startsOn) return 'upcoming';
  if (plan.status === 'paused') return 'paused';
  if (pauses.some((pause) => pause.startsOn <= date && date <= pause.endsOn)) return 'paused';
  return 'active';
}
