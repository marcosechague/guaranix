import type { ScopedTransaction } from '@guaranix/db';
import { charges, memberPlans, members, plans, savedCards } from '@guaranix/db/schema';
import { addDays, rangesOverlap } from '@guaranix/shared';
import { and, eq, exists, inArray, isNull, lt, lte, notExists, sql } from 'drizzle-orm';
import { recordSystemAudit } from './audit';

/** Plans that work as a subscription. Packs and drop-ins are bought again on purpose. */
const RENEWABLE_KINDS = ['unlimited', 'weekly_limit'] as const;

/**
 * For members paying by card, starts the next period of a monthly-style plan
 * the day before the current one ends, with an open charge due on its first
 * day for the autopay to collect. Uses the plan's current price, like a sale
 * at the front desk would. Never renews for someone with overdue debt, for a
 * plan the box stopped selling, or when the next period was already sold.
 * Idempotent: `renewed_from_id` is unique.
 */
export async function renewAutopayPlans(
  transaction: ScopedTransaction,
  boxId: string,
  accountId: string,
  today: string,
): Promise<number> {
  const tomorrow = addDays(today, 1);
  const candidates = await transaction
    .select({ current: memberPlans, plan: plans })
    .from(memberPlans)
    .innerJoin(plans, eq(plans.id, memberPlans.planId))
    .innerJoin(members, eq(members.id, memberPlans.memberId))
    .where(
      and(
        eq(memberPlans.status, 'active'),
        lte(memberPlans.endsOn, tomorrow),
        // Only the latest period: an older one that already ended is not renewed again.
        eq(
          memberPlans.endsOn,
          sql`(select max(mp.ends_on) from member_plans mp where mp.member_id = ${memberPlans.memberId} and mp.status in ('active', 'paused'))`,
        ),
        eq(members.status, 'active'),
        eq(plans.isActive, true),
        inArray(plans.kind, [...RENEWABLE_KINDS]),
        exists(
          transaction
            .select({ id: savedCards.id })
            .from(savedCards)
            .where(
              and(
                eq(savedCards.memberId, memberPlans.memberId),
                eq(savedCards.accountId, accountId),
                eq(savedCards.status, 'active'),
              ),
            ),
        ),
        notExists(
          transaction
            .select({ id: charges.id })
            .from(charges)
            .where(
              and(
                eq(charges.memberId, memberPlans.memberId),
                eq(charges.status, 'open'),
                lt(charges.dueOn, today),
              ),
            ),
        ),
        isNull(sql`(select r.id from member_plans r where r.renewed_from_id = ${memberPlans.id})`),
      ),
    );

  let renewed = 0;
  for (const { current, plan } of candidates) {
    const startsOn = addDays(current.endsOn, 1);
    const next = { startsOn, endsOn: addDays(startsOn, plan.durationDays - 1) };
    const live = await transaction
      .select({ startsOn: memberPlans.startsOn, endsOn: memberPlans.endsOn })
      .from(memberPlans)
      .where(
        and(
          eq(memberPlans.memberId, current.memberId),
          inArray(memberPlans.status, ['active', 'paused']),
        ),
      );
    if (live.some((existing) => rangesOverlap(existing, next))) continue;
    const [created] = await transaction
      .insert(memberPlans)
      .values({
        boxId,
        memberId: current.memberId,
        planId: plan.id,
        ...next,
        priceGs: plan.priceGs,
        classesPerWeek: plan.classesPerWeek,
        classesRemaining: plan.classCount,
        renewedFromId: current.id,
      })
      .onConflictDoNothing()
      .returning();
    if (!created) continue;
    if (plan.priceGs > 0) {
      await transaction.insert(charges).values({
        boxId,
        memberId: current.memberId,
        memberPlanId: created.id,
        description: plan.name,
        amountGs: plan.priceGs,
        dueOn: startsOn,
      });
    }
    await recordSystemAudit(transaction, boxId, {
      action: 'member_plan.renewed',
      entityType: 'member_plan',
      entityId: created.id,
      changes: {
        memberId: current.memberId,
        planId: plan.id,
        priceGs: plan.priceGs,
        renewedFromId: current.id,
        startsOn: next.startsOn,
        endsOn: next.endsOn,
      },
    });
    renewed += 1;
  }
  return renewed;
}
