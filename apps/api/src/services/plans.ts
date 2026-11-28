import { asc, eq } from 'drizzle-orm';
import type { z } from 'zod';
import { planLocations, planPrograms, plans, programs } from '@guaranix/db/schema';
import type { createPlanSchema } from '@guaranix/shared/schemas';
import { diff, recordAudit } from './audit';
import { notFound, unprocessable } from './errors';
import { assertLocationsExist } from './locations';
import { MANAGER_ROLES, assertRole, isStaff, type ServiceContext } from './context';

export type PlanInput = z.output<typeof createPlanSchema>;
export type PlanRow = typeof plans.$inferSelect;
export type PlanWithPrograms = PlanRow & { programIds: string[]; locationIds: string[] };

function groupByPlan<Row extends { planId: string }>(rows: Row[], id: (row: Row) => string) {
  const byPlan = new Map<string, string[]>();
  for (const row of rows) byPlan.set(row.planId, [...(byPlan.get(row.planId) ?? []), id(row)]);
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
  const programsByPlan = groupByPlan(
    await context.transaction.select().from(planPrograms),
    (row) => row.programId,
  );
  const locationsByPlan = groupByPlan(
    await context.transaction.select().from(planLocations),
    (row) => row.locationId,
  );
  return rows.map((plan) => ({
    ...plan,
    programIds: programsByPlan.get(plan.id) ?? [],
    locationIds: locationsByPlan.get(plan.id) ?? [],
  }));
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

async function setPlanLocations(context: ServiceContext, planId: string, locationIds: string[]) {
  const unique = [...new Set(locationIds)];
  await assertLocationsExist(context, unique);
  await context.transaction.delete(planLocations).where(eq(planLocations.planId, planId));
  if (unique.length > 0) {
    await context.transaction
      .insert(planLocations)
      .values(unique.map((locationId) => ({ boxId: context.auth.boxId, planId, locationId })));
  }
  return unique;
}

export async function createPlan(
  context: ServiceContext,
  input: PlanInput,
): Promise<PlanWithPrograms> {
  assertRole(context.auth.role, MANAGER_ROLES);
  const { programIds, locationIds, ...fields } = input;
  const [plan] = await context.transaction
    .insert(plans)
    .values({ ...fields, boxId: context.auth.boxId })
    .returning();
  if (!plan) throw new Error('Plan insert returned no row');
  const savedProgramIds = await setPlanPrograms(context, plan.id, programIds);
  const savedLocationIds = await setPlanLocations(context, plan.id, locationIds);
  await recordAudit(context, {
    action: 'plan.created',
    entityType: 'plan',
    entityId: plan.id,
    changes: { priceGs: plan.priceGs, kind: plan.kind },
  });
  return { ...plan, programIds: savedProgramIds, locationIds: savedLocationIds };
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
  assertRole(context.auth.role, MANAGER_ROLES);
  const before = await getPlan(context, planId);
  const { programIds, locationIds, ...fields } = input;
  const [plan] = await context.transaction
    .update(plans)
    .set(fields)
    .where(eq(plans.id, planId))
    .returning();
  if (!plan) throw notFound('plan');
  const savedProgramIds = await setPlanPrograms(context, plan.id, programIds);
  const savedLocationIds = await setPlanLocations(context, plan.id, locationIds);
  const changes = diff(before, fields);
  if (Object.keys(changes).length > 0) {
    await recordAudit(context, {
      action: changes['priceGs'] ? 'plan.price_changed' : 'plan.updated',
      entityType: 'plan',
      entityId: plan.id,
      changes,
    });
  }
  return { ...plan, programIds: savedProgramIds, locationIds: savedLocationIds };
}
