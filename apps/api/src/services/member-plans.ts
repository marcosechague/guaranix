import { and, desc, eq, inArray } from 'drizzle-orm';
import { charges, memberPlans, planPauses } from '@guaranix/db/schema';
import { addDays, inclusiveDayCount, rangesOverlap } from '@guaranix/shared';
import type { AssignMemberPlanInput } from '@guaranix/shared/schemas';
import { recordAudit } from './audit';
import { boxToday } from './box-calendar';
import { FRONT_DESK_ROLES, assertRole, type ServiceContext } from './context';
import { conflict, notFound, unprocessable } from './errors';
import { getMember } from './members';
import { memberPlanStateOn, type MemberPlanState } from './member-plan-state';
import { getPlan } from './plans';

export type MemberPlanRow = typeof memberPlans.$inferSelect;
export type PlanPauseRow = typeof planPauses.$inferSelect;
export type MemberPlanView = MemberPlanRow & { state: MemberPlanState; pauses: PlanPauseRow[] };

const LIVE_STATUSES = ['active', 'paused'] as const;

/**
 * Sells a plan to a member. Price and limits are copied from the plan so later
 * price changes don't touch this sale, and an open charge is created for the
 * amount so the member shows up as owing until a payment covers it.
 */
export async function assignMemberPlan(
  context: ServiceContext,
  input: AssignMemberPlanInput,
): Promise<MemberPlanRow> {
  assertRole(context.auth.role, FRONT_DESK_ROLES);
  const member = await getMember(context, input.memberId);
  if (member.status !== 'active') throw unprocessable('member_inactive');
  const plan = await getPlan(context, input.planId);
  if (!plan.isActive) throw unprocessable('plan_inactive');

  const startsOn = input.startsOn;
  const endsOn = addDays(startsOn, plan.durationDays - 1);
  const live = await context.transaction
    .select()
    .from(memberPlans)
    .where(and(eq(memberPlans.memberId, member.id), inArray(memberPlans.status, LIVE_STATUSES)));
  if (live.some((existing) => rangesOverlap(existing, { startsOn, endsOn }))) {
    throw conflict('member_plan_overlap');
  }

  const priceGs = input.priceGs ?? plan.priceGs;
  const [memberPlan] = await context.transaction
    .insert(memberPlans)
    .values({
      boxId: context.auth.boxId,
      memberId: member.id,
      planId: plan.id,
      startsOn,
      endsOn,
      priceGs,
      classesPerWeek: plan.classesPerWeek,
      classesRemaining: plan.classCount,
    })
    .returning();
  if (!memberPlan) throw new Error('Member plan insert returned no row');

  if (priceGs > 0) {
    await context.transaction.insert(charges).values({
      boxId: context.auth.boxId,
      memberId: member.id,
      memberPlanId: memberPlan.id,
      description: plan.name,
      amountGs: priceGs,
      dueOn: startsOn,
    });
  }
  await recordAudit(context, {
    action: 'member_plan.assigned',
    entityType: 'member_plan',
    entityId: memberPlan.id,
    changes: {
      memberId: member.id,
      planId: plan.id,
      priceGs,
      listPriceGs: plan.priceGs,
      startsOn,
      endsOn,
    },
  });
  return memberPlan;
}

async function pausesOf(context: ServiceContext, memberPlanIds: string[]) {
  if (memberPlanIds.length === 0) return [];
  return context.transaction
    .select()
    .from(planPauses)
    .where(inArray(planPauses.memberPlanId, memberPlanIds))
    .orderBy(planPauses.startsOn);
}

/** A member's plans, newest first, each with its pauses and its state today. */
export async function listMemberPlans(
  context: ServiceContext,
  memberId: string,
): Promise<MemberPlanView[]> {
  const member = await getMember(context, memberId);
  const rows = await context.transaction
    .select()
    .from(memberPlans)
    .where(eq(memberPlans.memberId, member.id))
    .orderBy(desc(memberPlans.startsOn));
  const pauses = await pausesOf(
    context,
    rows.map((row) => row.id),
  );
  const today = await boxToday(context);
  return rows.map((row) => {
    const own = pauses.filter((pause) => pause.memberPlanId === row.id);
    return { ...row, pauses: own, state: memberPlanStateOn(row, own, today) };
  });
}

async function getMemberPlan(context: ServiceContext, memberPlanId: string) {
  const [memberPlan] = await context.transaction
    .select()
    .from(memberPlans)
    .where(eq(memberPlans.id, memberPlanId));
  if (!memberPlan) throw notFound('member_plan');
  return memberPlan;
}

interface PauseInput {
  startsOn: string;
  endsOn: string;
  reason: string | null;
}

/**
 * Freezes a plan for a date range and pushes its end date back by the same
 * number of days, so the member doesn't lose the days they couldn't train.
 */
export async function pauseMemberPlan(
  context: ServiceContext,
  memberPlanId: string,
  input: PauseInput,
): Promise<{ pause: PlanPauseRow; memberPlan: MemberPlanRow }> {
  assertRole(context.auth.role, FRONT_DESK_ROLES);
  const memberPlan = await getMemberPlan(context, memberPlanId);
  if (memberPlan.status !== 'active') throw unprocessable('member_plan_not_active');
  if (input.endsOn < input.startsOn) throw unprocessable('pause_dates_invalid');
  if (input.startsOn < memberPlan.startsOn || input.startsOn > memberPlan.endsOn) {
    throw unprocessable('pause_outside_plan');
  }
  const existing = await pausesOf(context, [memberPlan.id]);
  if (existing.some((pause) => rangesOverlap(pause, input))) throw conflict('pause_overlap');

  const pauseDays = inclusiveDayCount(input.startsOn, input.endsOn);
  const [pause] = await context.transaction
    .insert(planPauses)
    .values({
      boxId: context.auth.boxId,
      memberPlanId: memberPlan.id,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      reason: input.reason,
      createdByUserId: context.auth.userId,
    })
    .returning();
  const [updated] = await context.transaction
    .update(memberPlans)
    .set({ endsOn: addDays(memberPlan.endsOn, pauseDays) })
    .where(eq(memberPlans.id, memberPlan.id))
    .returning();
  if (!pause || !updated) throw new Error('Pause was not saved');
  await recordAudit(context, {
    action: 'member_plan.paused',
    entityType: 'member_plan',
    entityId: memberPlan.id,
    changes: {
      pauseId: pause.id,
      startsOn: pause.startsOn,
      endsOn: pause.endsOn,
      planEndsOn: { from: memberPlan.endsOn, to: updated.endsOn },
    },
  });
  return { pause, memberPlan: updated };
}

/** Removes a pause that hasn't started yet and gives the extra days back. */
export async function removePause(
  context: ServiceContext,
  pauseId: string,
): Promise<MemberPlanRow> {
  assertRole(context.auth.role, FRONT_DESK_ROLES);
  const [pause] = await context.transaction
    .select()
    .from(planPauses)
    .where(eq(planPauses.id, pauseId));
  if (!pause) throw notFound('pause');
  if (pause.startsOn <= (await boxToday(context))) throw unprocessable('pause_already_started');
  const memberPlan = await getMemberPlan(context, pause.memberPlanId);
  await context.transaction.delete(planPauses).where(eq(planPauses.id, pause.id));
  const [updated] = await context.transaction
    .update(memberPlans)
    .set({ endsOn: addDays(memberPlan.endsOn, -inclusiveDayCount(pause.startsOn, pause.endsOn)) })
    .where(eq(memberPlans.id, memberPlan.id))
    .returning();
  if (!updated) throw notFound('member_plan');
  await recordAudit(context, {
    action: 'member_plan.pause_removed',
    entityType: 'member_plan',
    entityId: memberPlan.id,
    changes: { pauseId: pause.id, planEndsOn: { from: memberPlan.endsOn, to: updated.endsOn } },
  });
  return updated;
}

/** Ends a plan early. Its charges stay as they are: voiding money is a separate, explicit step. */
export async function cancelMemberPlan(
  context: ServiceContext,
  memberPlanId: string,
): Promise<MemberPlanRow> {
  assertRole(context.auth.role, FRONT_DESK_ROLES);
  const memberPlan = await getMemberPlan(context, memberPlanId);
  if (memberPlan.status === 'cancelled') return memberPlan;
  const [updated] = await context.transaction
    .update(memberPlans)
    .set({ status: 'cancelled' })
    .where(eq(memberPlans.id, memberPlan.id))
    .returning();
  if (!updated) throw notFound('member_plan');
  await recordAudit(context, {
    action: 'member_plan.cancelled',
    entityType: 'member_plan',
    entityId: memberPlan.id,
    changes: { status: { from: memberPlan.status, to: 'cancelled' } },
  });
  return updated;
}
