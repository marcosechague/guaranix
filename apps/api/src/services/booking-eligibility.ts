import { and, count, eq, gte, inArray, lt } from 'drizzle-orm';
import {
  bookings,
  classes,
  memberPlans,
  planLocations,
  planPauses,
  planPrograms,
} from '@guaranix/db/schema';
import type { BookingStatus } from '@guaranix/shared/domain';
import { addDays, calendarDateIn, startOfWeek, zonedInstant } from '@guaranix/shared';
import type { ServiceContext } from './context';
import { unprocessable } from './errors';
import { memberPlanStateOn } from './member-plan-state';

type ClassRow = typeof classes.$inferSelect;
type MemberPlanRow = typeof memberPlans.$inferSelect;

export interface BookingPolicy {
  timezone: string;
  lateCancelConsumesCredit: boolean;
  noShowConsumesCredit: boolean;
}

/** Bookings that use up a spot of a weekly plan, given the box's policy. */
export function weeklyCountedStatuses(policy: BookingPolicy): BookingStatus[] {
  const statuses: BookingStatus[] = ['booked', 'attended'];
  if (policy.noShowConsumesCredit) statuses.push('no_show');
  if (policy.lateCancelConsumesCredit) statuses.push('late_cancelled');
  return statuses;
}

async function weeklyUsage(
  context: ServiceContext,
  memberPlanId: string,
  classDate: string,
  policy: BookingPolicy,
): Promise<number> {
  const monday = startOfWeek(classDate);
  const [row] = await context.transaction
    .select({ used: count() })
    .from(bookings)
    .innerJoin(classes, eq(classes.id, bookings.classId))
    .where(
      and(
        eq(bookings.memberPlanId, memberPlanId),
        inArray(bookings.status, weeklyCountedStatuses(policy)),
        gte(classes.startsAt, zonedInstant(monday, '00:00', policy.timezone)),
        lt(classes.startsAt, zonedInstant(addDays(monday, 7), '00:00', policy.timezone)),
      ),
    );
  return row?.used ?? 0;
}

async function coversProgram(context: ServiceContext, planId: string, programId: string) {
  const rows = await context.transaction
    .select({ programId: planPrograms.programId })
    .from(planPrograms)
    .where(eq(planPrograms.planId, planId));
  // No rows means the plan gives access to every program.
  return rows.length === 0 || rows.some((row) => row.programId === programId);
}

async function coversLocation(context: ServiceContext, planId: string, locationId: string) {
  const rows = await context.transaction
    .select({ locationId: planLocations.locationId })
    .from(planLocations)
    .where(eq(planLocations.planId, planId));
  // No rows means the plan works at every location (the pass between locations).
  return rows.length === 0 || rows.some((row) => row.locationId === locationId);
}

/** Unlimited and weekly plans first, so pack credits are kept; then whatever ends soonest. */
function byPreference(first: MemberPlanRow, second: MemberPlanRow): number {
  const usesCredits = (plan: MemberPlanRow) => (plan.classesRemaining === null ? 0 : 1);
  return usesCredits(first) - usesCredits(second) || first.endsOn.localeCompare(second.endsOn);
}

/**
 * Picks the member plan that pays for a class: valid on the class's local
 * date (pauses included), covering its program and location, with a credit or a weekly
 * spot left. Throws the most specific reason when none qualifies.
 */
export async function findPlanForClass(
  context: ServiceContext,
  memberId: string,
  classRow: ClassRow,
  policy: BookingPolicy,
): Promise<MemberPlanRow> {
  const classDate = calendarDateIn(policy.timezone, classRow.startsAt);
  const candidates = await context.transaction
    .select()
    .from(memberPlans)
    .where(and(eq(memberPlans.memberId, memberId), eq(memberPlans.status, 'active')));
  const pauses = candidates.length
    ? await context.transaction
        .select()
        .from(planPauses)
        .where(
          inArray(
            planPauses.memberPlanId,
            candidates.map((plan) => plan.id),
          ),
        )
    : [];

  const valid = candidates.filter(
    (plan) =>
      memberPlanStateOn(
        plan,
        pauses.filter((pause) => pause.memberPlanId === plan.id),
        classDate,
      ) === 'active',
  );
  if (valid.length === 0) throw unprocessable('no_valid_plan');

  const covering = [];
  for (const plan of valid) {
    if (await coversProgram(context, plan.planId, classRow.programId)) covering.push(plan);
  }
  if (covering.length === 0) throw unprocessable('plan_excludes_program');

  const atLocation = [];
  for (const plan of covering) {
    if (await coversLocation(context, plan.planId, classRow.locationId)) atLocation.push(plan);
  }
  if (atLocation.length === 0) throw unprocessable('plan_excludes_location');

  let reason = 'no_credits_left';
  for (const plan of atLocation.sort(byPreference)) {
    if (plan.classesRemaining !== null && plan.classesRemaining <= 0) continue;
    if (plan.classesPerWeek !== null) {
      const used = await weeklyUsage(context, plan.id, classDate, policy);
      if (used >= plan.classesPerWeek) {
        reason = 'weekly_limit_reached';
        continue;
      }
    }
    return plan;
  }
  throw unprocessable(reason);
}
