import { and, eq, gte, inArray, lt, lte, ne, sum } from 'drizzle-orm';
import {
  bookings,
  charges,
  classes,
  memberPlans,
  members,
  payments,
  planPauses,
} from '@guaranix/db/schema';
import { addDays, daysBetween, zonedInstant } from '@guaranix/shared';
import { currentBox, boxToday } from './box-calendar';
import { SPOT_STATUSES } from './bookings';
import { confirmedPaidByCharge } from './charges';
import { MANAGER_ROLES, assertRole, type ServiceContext } from './context';
import { unprocessable } from './errors';
import { memberPlanStateOn } from './member-plan-state';

const MAX_DASHBOARD_DAYS = 92;

async function moneyFigures(context: ServiceContext, from: Date, to: Date, today: string) {
  const [collected] = await context.transaction
    .select({ total: sum(payments.amountGs).mapWith(Number) })
    .from(payments)
    .where(
      and(eq(payments.status, 'confirmed'), gte(payments.paidAt, from), lt(payments.paidAt, to)),
    );
  const [pendingReview] = await context.transaction
    .select({ total: sum(payments.amountGs).mapWith(Number) })
    .from(payments)
    .where(eq(payments.status, 'pending_review'));
  const open = await context.transaction.select().from(charges).where(eq(charges.status, 'open'));
  const paid = await confirmedPaidByCharge(
    context,
    open.map((charge) => charge.id),
  );
  let outstandingGs = 0;
  let overdueGs = 0;
  for (const charge of open) {
    const owed = Math.max(charge.amountGs - (paid.get(charge.id) ?? 0), 0);
    outstandingGs += owed;
    if (charge.dueOn < today) overdueGs += owed;
  }
  return {
    collectedGs: collected?.total ?? 0,
    pendingReviewGs: pendingReview?.total ?? 0,
    outstandingGs,
    overdueGs,
  };
}

/**
 * Active members today, and who joined or left in the range. A member "left"
 * when their last plan ended inside the range and nothing covers them after it.
 */
async function memberFigures(
  context: ServiceContext,
  range: { from: string; to: string },
  today: string,
) {
  const plans = await context.transaction
    .select()
    .from(memberPlans)
    .where(ne(memberPlans.status, 'cancelled'));
  const pauses = await context.transaction.select().from(planPauses);
  const active = new Set<string>();
  const lastEnd = new Map<string, string>();
  for (const plan of plans) {
    const own = pauses.filter((pause) => pause.memberPlanId === plan.id);
    const state = memberPlanStateOn(plan, own, today);
    if (state === 'active' || state === 'paused') active.add(plan.memberId);
    const previous = lastEnd.get(plan.memberId);
    if (!previous || plan.endsOn > previous) lastEnd.set(plan.memberId, plan.endsOn);
  }
  const joined = await context.transaction
    .select({ id: members.id })
    .from(members)
    .where(and(gte(members.joinedOn, range.from), lte(members.joinedOn, range.to)));
  const left = [...lastEnd.entries()].filter(
    ([, endsOn]) => endsOn >= range.from && endsOn <= range.to && endsOn < today,
  );
  return { activeMembers: active.size, newMembers: joined.length, lostMembers: left.length };
}

/** Booked spots over capacity for classes that already happened in the range. */
async function occupancy(context: ServiceContext, from: Date, to: Date) {
  const until = context.now < to ? context.now : to;
  const past = await context.transaction
    .select({ id: classes.id, capacity: classes.capacity })
    .from(classes)
    .where(
      and(
        eq(classes.status, 'scheduled'),
        gte(classes.startsAt, from),
        lt(classes.startsAt, until),
      ),
    );
  if (past.length === 0) return { classes: 0, occupancyRate: null, attended: 0 };
  const taken = await context.transaction
    .select({ status: bookings.status })
    .from(bookings)
    .where(
      and(
        inArray(
          bookings.classId,
          past.map((row) => row.id),
        ),
        inArray(bookings.status, SPOT_STATUSES),
      ),
    );
  const capacity = past.reduce((total, row) => total + row.capacity, 0);
  return {
    classes: past.length,
    occupancyRate: Math.round((taken.length / capacity) * 1000) / 1000,
    attended: taken.filter((booking) => booking.status === 'attended').length,
  };
}

/** The owner's home screen: money, members and occupancy for a date range (box-local, inclusive). */
export async function dashboard(context: ServiceContext, range: { from: string; to: string }) {
  assertRole(context.auth.role, MANAGER_ROLES);
  const days = daysBetween(range.from, range.to) + 1;
  if (days < 1 || days > MAX_DASHBOARD_DAYS) throw unprocessable('date_range_invalid');
  const box = await currentBox(context);
  const today = await boxToday(context);
  const from = zonedInstant(range.from, '00:00', box.timezone);
  const to = zonedInstant(addDays(range.to, 1), '00:00', box.timezone);
  return {
    range,
    money: await moneyFigures(context, from, to, today),
    members: await memberFigures(context, range, today),
    classes: await occupancy(context, from, to),
  };
}
