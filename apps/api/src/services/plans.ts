import { asc, eq } from 'drizzle-orm';
import type { z } from 'zod';
import { planPrograms, plans, programs } from '@guaranix/db/schema';
import type { createPlanSchema } from '@guaranix/shared/schemas';
import { diff, recordAudit } from './audit';
import { forbidden, notFound, unprocessable } from './errors';
import { MANAGER_ROLES, isStaff, type ServiceContext } from './context';
import type { BoxRole } from '@guaranix/shared/domain';

export type PlanInput = z.output<typeof createPlanSchema>;
export type PlanRow = typeof plans.$inferSelect;
export type PlanWithPrograms = PlanRow & { programIds: string[] };

function assertManager(role: BoxRole) {
  if (!(MANAGER_ROLES as readonly BoxRole[]).includes(role)) throw forbidden();
}

async function programIdsByPlan(context: ServiceContext): Promise<Map<string, string[]>> {
  const rows = await context.transaction.select().from(planPrograms);
  const byPlan = new Map<string, string[]>();
  for (const row of rows)
    byPlan.set(row.planId, [...(byPlan.get(row.planId) ?? []), row.programId]);
  return byPlan;
}

/** Members only see plans on sale; staff also see retired ones. */
export async function listPlans(context: ServiceContext): Promise<PlanWithPrograms[]> {
  const query = context.transaction
    .select()
    .from(plans)
    .orderBy(asc(plans.priceGs), asc(plans.name));
  const rows = isStaff(context.auth.role)
    ? await query
    : await query.where(eq(plans.isActive, true));
  const byPlan = await programIdsByPlan(context);
  return rows.map((plan) => ({ ...plan, programIds: byPlan.get(plan.id) ?? [] }));
}

export async function getPlan(context: ServiceContext, planId: string): Promise<PlanRow> {
  const [plan] = await context.transaction.select().from(plans).where(eq(plans.id, planId));
  if (!plan) throw notFound('plan');
  return plan;
}

async function setPlanPrograms(context: ServiceContext, planId: string, programIds: string[]) {
  const unique = [...new Set(programIds)];
  if (unique.length > 0) {
    const known = await context.transaction.select({ id: programs.id }).from(programs);
    const knownIds = new Set(known.map((program) => program.id));
    if (unique.some((id) => !knownIds.has(id))) throw unprocessable('program_not_found');
  }
  await context.transaction.delete(planPrograms).where(eq(planPrograms.planId, planId));
  if (unique.length > 0) {
    await context.transaction
      .insert(planPrograms)
      .values(unique.map((programId) => ({ boxId: context.auth.boxId, planId, programId })));
  }
  return unique;
}

export async function createPlan(
  context: ServiceContext,
  input: PlanInput,
): Promise<PlanWithPrograms> {
  assertManager(context.auth.role);
  const { programIds, ...fields } = input;
  const [plan] = await context.transaction
    .insert(plans)
    .values({ ...fields, boxId: context.auth.boxId })
    .returning();
  if (!plan) throw new Error('Plan insert returned no row');
  const savedProgramIds = await setPlanPrograms(context, plan.id, programIds);
  await recordAudit(context, {
    action: 'plan.created',
    entityType: 'plan',
    entityId: plan.id,
    changes: { priceGs: plan.priceGs, kind: plan.kind },
  });
  return { ...plan, programIds: savedProgramIds };
}

/**
 * Replaces a plan's terms. Members who already bought it keep the price and
 * limits frozen in `member_plans`; only new sales see the change.
 */
export async function updatePlan(
  context: ServiceContext,
  planId: string,
  input: PlanInput,
): Promise<PlanWithPrograms> {
  assertManager(context.auth.role);
  const before = await getPlan(context, planId);
  const { programIds, ...fields } = input;
  const [plan] = await context.transaction
    .update(plans)
    .set(fields)
    .where(eq(plans.id, planId))
    .returning();
  if (!plan) throw notFound('plan');
  const savedProgramIds = await setPlanPrograms(context, plan.id, programIds);
  const changes = diff(before, fields);
  if (Object.keys(changes).length > 0) {
    await recordAudit(context, {
      action: changes['priceGs'] ? 'plan.price_changed' : 'plan.updated',
      entityType: 'plan',
      entityId: plan.id,
      changes,
    });
  }
  return { ...plan, programIds: savedProgramIds };
}
