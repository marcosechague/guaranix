import type { ScopedTransaction } from '@guaranix/db';
import { boxes, platformPlans } from '@guaranix/db/schema';
import type { PlatformPlanInput, UpdatePlatformPlanInput } from '@guaranix/shared';
import { platformPlanInputSchema } from '@guaranix/shared';
import { and, asc, count, eq, ne } from 'drizzle-orm';
import { diff } from './audit';
import { conflict, isUniqueViolation, notFound, unprocessable } from './errors';
import { definedFields } from './objects';
import { type PlatformContext, recordPlatformAudit } from './platform-context';

export async function listPlatformPlans(context: PlatformContext) {
  const usage = context.transaction
    .select({ planId: boxes.platformPlanId, boxCount: count().as('box_count') })
    .from(boxes)
    .where(ne(boxes.status, 'cancelled'))
    .groupBy(boxes.platformPlanId)
    .as('usage');
  const rows = await context.transaction
    .select({ plan: platformPlans, boxCount: usage.boxCount })
    .from(platformPlans)
    .leftJoin(usage, eq(usage.planId, platformPlans.id))
    .orderBy(asc(platformPlans.monthlyPriceGs));
  return rows.map(({ plan, boxCount }) => ({ ...plan, boxCount: boxCount ?? 0 }));
}

export async function createPlatformPlan(context: PlatformContext, input: PlatformPlanInput) {
  const values = platformPlanInputSchema.parse(input);
  try {
    const [plan] = await context.transaction.insert(platformPlans).values(values).returning();
    if (!plan) throw notFound('platform_plan');
    await recordPlatformAudit(context, {
      action: 'platform_plan.created',
      entityType: 'platform_plan',
      entityId: plan.id,
      boxId: null,
      changes: values,
    });
    return plan;
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict('platform_plan_code_taken');
    throw error;
  }
}

export async function updatePlatformPlan(
  context: PlatformContext,
  planId: string,
  input: UpdatePlatformPlanInput,
) {
  const [before] = await context.transaction
    .select()
    .from(platformPlans)
    .where(eq(platformPlans.id, planId))
    .for('update');
  if (!before) throw notFound('platform_plan');
  if (input.boxLimit != null && input.boxLimit < (await boxesOnPlan(context.transaction, planId))) {
    throw unprocessable('platform_plan_limit_below_usage');
  }
  const [plan] = await context.transaction
    .update(platformPlans)
    .set(definedFields(input))
    .where(eq(platformPlans.id, planId))
    .returning();
  await recordPlatformAudit(context, {
    action: 'platform_plan.updated',
    entityType: 'platform_plan',
    entityId: planId,
    boxId: null,
    changes: diff(before, definedFields(input)),
  });
  return plan;
}

/** Boxes holding a place on the plan (removed boxes free theirs). */
export async function boxesOnPlan(transaction: ScopedTransaction, planId: string): Promise<number> {
  const [row] = await transaction
    .select({ total: count() })
    .from(boxes)
    .where(and(eq(boxes.platformPlanId, planId), ne(boxes.status, 'cancelled')));
  return row?.total ?? 0;
}

/** The plan a box may move to: it must exist, be offered, and have room left. */
export async function assertPlanAvailable(context: PlatformContext, planId: string) {
  const [plan] = await context.transaction
    .select()
    .from(platformPlans)
    .where(eq(platformPlans.id, planId))
    .for('update');
  if (!plan) throw notFound('platform_plan');
  if (!plan.isActive) throw unprocessable('platform_plan_inactive');
  if (plan.boxLimit !== null && (await boxesOnPlan(context.transaction, planId)) >= plan.boxLimit) {
    throw unprocessable('platform_plan_full');
  }
  return plan;
}
