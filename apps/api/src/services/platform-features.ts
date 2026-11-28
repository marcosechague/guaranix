import {
  boxes,
  boxFeatureOverrides,
  platformPlanFeatures,
  platformPlans,
} from '@guaranix/db/schema';
import {
  type BoxFeatureInput,
  boxFeatureInputSchema,
  type BoxFeatureState,
  type PlanFeatureInput,
  planFeatureInputSchema,
  type PlanFeatureState,
} from '@guaranix/shared';
import { FEATURE_FLAGS, type FeatureFlag } from '@guaranix/shared/domain';
import { and, eq } from 'drizzle-orm';
import { boxFeatureState } from './feature-access';
import { notFound } from './errors';
import { type PlatformContext, recordPlatformAudit } from './platform-context';

async function assertPlanExists(context: PlatformContext, planId: string) {
  const [plan] = await context.transaction
    .select({ id: platformPlans.id })
    .from(platformPlans)
    .where(eq(platformPlans.id, planId));
  if (!plan) throw notFound('platform_plan');
}

/** Every feature for a GuaraniX plan; one without a row is off. */
export async function listPlanFeatures(
  context: PlatformContext,
  planId: string,
): Promise<PlanFeatureState[]> {
  await assertPlanExists(context, planId);
  const rows = await context.transaction
    .select()
    .from(platformPlanFeatures)
    .where(eq(platformPlanFeatures.platformPlanId, planId));
  return FEATURE_FLAGS.map((feature) => {
    const row = rows.find((candidate) => candidate.feature === feature);
    return { feature, enabled: row?.enabled ?? false, monthlyLimit: row?.monthlyLimit ?? null };
  });
}

export async function setPlanFeature(
  context: PlatformContext,
  planId: string,
  feature: FeatureFlag,
  input: PlanFeatureInput,
): Promise<PlanFeatureState> {
  await assertPlanExists(context, planId);
  const values = planFeatureInputSchema.parse(input);
  const [before] = await context.transaction
    .select({
      enabled: platformPlanFeatures.enabled,
      monthlyLimit: platformPlanFeatures.monthlyLimit,
    })
    .from(platformPlanFeatures)
    .where(
      and(
        eq(platformPlanFeatures.platformPlanId, planId),
        eq(platformPlanFeatures.feature, feature),
      ),
    );
  await context.transaction
    .insert(platformPlanFeatures)
    .values({ platformPlanId: planId, feature, ...values, updatedByUserId: context.actorUserId })
    .onConflictDoUpdate({
      target: [platformPlanFeatures.platformPlanId, platformPlanFeatures.feature],
      set: { ...values, updatedByUserId: context.actorUserId, updatedAt: context.now },
    });
  await recordPlatformAudit(context, {
    action: 'platform_plan.feature_updated',
    entityType: 'platform_plan',
    entityId: planId,
    boxId: null,
    changes: { feature, before: before ?? null, after: values },
  });
  return { feature, ...values };
}

async function assertBoxExists(context: PlatformContext, boxId: string) {
  const [box] = await context.transaction
    .select({ id: boxes.id })
    .from(boxes)
    .where(eq(boxes.id, boxId));
  if (!box) throw notFound('box');
}

export async function listBoxFeatures(
  context: PlatformContext,
  boxId: string,
): Promise<BoxFeatureState[]> {
  await assertBoxExists(context, boxId);
  return Promise.all(
    FEATURE_FLAGS.map((feature) =>
      boxFeatureState(context.transaction, boxId, feature, context.now),
    ),
  );
}

/** Sets or clears the platform's override for one box; null on both fields returns to the plan. */
export async function setBoxFeature(
  context: PlatformContext,
  boxId: string,
  feature: FeatureFlag,
  input: BoxFeatureInput,
): Promise<BoxFeatureState> {
  await assertBoxExists(context, boxId);
  const values = boxFeatureInputSchema.parse(input);
  const where = and(eq(boxFeatureOverrides.boxId, boxId), eq(boxFeatureOverrides.feature, feature));
  if (values.enabled === null && values.monthlyLimit === null) {
    await context.transaction.delete(boxFeatureOverrides).where(where);
  } else {
    await context.transaction
      .insert(boxFeatureOverrides)
      .values({ boxId, feature, ...values, updatedByUserId: context.actorUserId })
      .onConflictDoUpdate({
        target: [boxFeatureOverrides.boxId, boxFeatureOverrides.feature],
        set: { ...values, updatedByUserId: context.actorUserId, updatedAt: context.now },
      });
  }
  // Audited with the box id so the box's own history shows the platform's decision.
  await recordPlatformAudit(context, {
    action: 'box.feature_overridden',
    entityType: 'box',
    entityId: boxId,
    boxId,
    changes: { feature, ...values },
  });
  return boxFeatureState(context.transaction, boxId, feature, context.now);
}
