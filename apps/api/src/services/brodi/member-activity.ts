import { bookings, classes, memberPlans, members, planPauses, plans } from '@guaranix/db/schema';
import { addDays, daysBetween, dateOfInstant } from '@guaranix/shared';
import { and, eq, inArray, lt, max, ne } from 'drizzle-orm';
import type { ServiceContext } from '../context';
import { memberPlanStateOn } from '../member-plan-state';

/** A booking that means the member was there (or at least meant to be): no-shows don't count. */
const VISIT_STATUSES = ['booked', 'attended'] as const;

export interface ActiveMember {
  memberId: string;
  name: string;
  /** Last class they came to, box-local; null if never. */
  lastVisitOn: string | null;
  /** End of the plan that covers them today. */
  planName: string;
  planEndsOn: string;
}

/**
 * Members with a plan running (or paused) today, with their last visit and
 * when the plan ends. Everything runs in the caller's box scope.
 */
export async function activeMembers(
  context: ServiceContext,
  timeZone: string,
  today: string,
): Promise<ActiveMember[]> {
  const rows = await context.transaction
    .select({
      plan: memberPlans,
      planName: plans.name,
      firstName: members.firstName,
      lastName: members.lastName,
    })
    .from(memberPlans)
    .innerJoin(plans, eq(plans.id, memberPlans.planId))
    .innerJoin(members, eq(members.id, memberPlans.memberId))
    .where(ne(memberPlans.status, 'cancelled'));
  const pauses = await context.transaction.select().from(planPauses);
  const byMember = new Map<string, ActiveMember>();
  for (const row of rows) {
    const own = pauses.filter((pause) => pause.memberPlanId === row.plan.id);
    const state = memberPlanStateOn(row.plan, own, today);
    if (state !== 'active' && state !== 'paused') continue;
    const current = byMember.get(row.plan.memberId);
    if (current && current.planEndsOn >= row.plan.endsOn) continue;
    byMember.set(row.plan.memberId, {
      memberId: row.plan.memberId,
      name: `${row.firstName} ${row.lastName}`.trim(),
      lastVisitOn: null,
      planName: row.planName,
      planEndsOn: row.plan.endsOn,
    });
  }
  if (byMember.size === 0) return [];
  const visits = await context.transaction
    .select({ memberId: bookings.memberId, lastStart: max(classes.startsAt) })
    .from(bookings)
    .innerJoin(classes, eq(classes.id, bookings.classId))
    .where(
      and(
        inArray(bookings.memberId, [...byMember.keys()]),
        inArray(bookings.status, [...VISIT_STATUSES]),
        lt(classes.startsAt, context.now),
      ),
    )
    .groupBy(bookings.memberId);
  for (const visit of visits) {
    const member = byMember.get(visit.memberId);
    if (member && visit.lastStart) member.lastVisitOn = dateOfInstant(timeZone, visit.lastStart);
  }
  return [...byMember.values()];
}

/** Sorts members who never came before everyone else. */
const NEVER = Number.MAX_SAFE_INTEGER;

/** Active members who have not come in `days` days (or ever), longest absence first. */
export function absentFor(members: ActiveMember[], today: string, days: number) {
  const cutoff = addDays(today, -days);
  return members
    .filter((member) => member.lastVisitOn === null || member.lastVisitOn <= cutoff)
    .map((member) => ({
      name: member.name,
      lastVisitOn: member.lastVisitOn,
      daysAway: member.lastVisitOn === null ? null : daysBetween(member.lastVisitOn, today),
    }))
    .sort((first, second) => (second.daysAway ?? NEVER) - (first.daysAway ?? NEVER));
}

/** Plans that end within `days` days, soonest first. */
export function expiringWithin(members: ActiveMember[], today: string, days: number) {
  const until = addDays(today, days);
  return members
    .filter((member) => member.planEndsOn <= until)
    .map((member) => ({ name: member.name, plan: member.planName, endsOn: member.planEndsOn }))
    .sort((first, second) => first.endsOn.localeCompare(second.endsOn));
}
