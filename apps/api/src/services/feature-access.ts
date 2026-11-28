import type { ScopedTransaction } from '@guaranix/db';
import {
  aiUsage,
  boxes,
  boxFeatureOverrides,
  notificationDeliveries,
  platformPlanFeatures,
} from '@guaranix/db/schema';
import {
  type BoxFeatureState,
  calendarDateIn,
  type FeatureSetting,
  zonedInstant,
} from '@guaranix/shared';
import type { FeatureFlag } from '@guaranix/shared/domain';
import { and, count, eq, gte, inArray } from 'drizzle-orm';
import type { ServiceContext } from './context';
import { notFound, unprocessable } from './errors';

const OFF: FeatureSetting = { enabled: false, monthlyLimit: null };

/** First instant of the box's current calendar month: limits reset on the 1st, local time. */
export function monthStart(timeZone: string, now: Date): Date {
  const today = calendarDateIn(timeZone, now);
  return zonedInstant(`${today.slice(0, 8)}01`, '00:00', timeZone);
}

/** WhatsApp messages queued, in flight or sent; failed and skipped ones cost nothing. */
const BILLABLE_DELIVERY_STATUSES = ['queued', 'sending', 'sent'] as const;

/** What one "use" is: an AI request, or a WhatsApp message. */
async function usesSince(
  transaction: ScopedTransaction,
  boxId: string,
  feature: FeatureFlag,
  since: Date,
): Promise<number> {
  const [used] =
    feature === 'whatsapp'
      ? await transaction
          .select({ total: count() })
          .from(notificationDeliveries)
          .where(
            and(
              eq(notificationDeliveries.boxId, boxId),
              eq(notificationDeliveries.channel, 'whatsapp'),
              inArray(notificationDeliveries.status, [...BILLABLE_DELIVERY_STATUSES]),
              gte(notificationDeliveries.createdAt, since),
            ),
          )
      : await transaction
          .select({ total: count() })
          .from(aiUsage)
          .where(
            and(
              eq(aiUsage.boxId, boxId),
              eq(aiUsage.feature, feature),
              gte(aiUsage.createdAt, since),
            ),
          );
  return used?.total ?? 0;
}

/**
 * Plan setting, platform override and uses this month for one box. Every query
 * names the box explicitly, so it is correct both inside a box scope (where RLS
 * adds the same filter) and in the platform's unscoped transaction.
 */
export async function boxFeatureState(
  transaction: ScopedTransaction,
  boxId: string,
  feature: FeatureFlag,
  now: Date,
): Promise<BoxFeatureState> {
  const [box] = await transaction
    .select({ planId: boxes.platformPlanId, timezone: boxes.timezone })
    .from(boxes)
    .where(eq(boxes.id, boxId));
  if (!box) throw notFound('box');
  const [planRow] = box.planId
    ? await transaction
        .select({
          enabled: platformPlanFeatures.enabled,
          monthlyLimit: platformPlanFeatures.monthlyLimit,
        })
        .from(platformPlanFeatures)
        .where(
          and(
            eq(platformPlanFeatures.platformPlanId, box.planId),
            eq(platformPlanFeatures.feature, feature),
          ),
        )
    : [];
  const [override] = await transaction
    .select({
      enabled: boxFeatureOverrides.enabled,
      monthlyLimit: boxFeatureOverrides.monthlyLimit,
    })
    .from(boxFeatureOverrides)
    .where(and(eq(boxFeatureOverrides.boxId, boxId), eq(boxFeatureOverrides.feature, feature)));
  const usedThisMonth = await usesSince(transaction, boxId, feature, monthStart(box.timezone, now));
  const plan = planRow ?? OFF;
  return {
    feature,
    plan,
    override: override ?? null,
    effective: {
      enabled: override?.enabled ?? plan.enabled,
      monthlyLimit: override?.monthlyLimit ?? plan.monthlyLimit,
    },
    usedThisMonth,
  };
}

/**
 * Throws unless the box's plan (or a platform override) includes the feature
 * and this month's uses are below the limit. Call before spending on a provider.
 */
export async function assertFeatureAvailable(
  context: ServiceContext,
  feature: FeatureFlag,
): Promise<BoxFeatureState> {
  const state = await boxFeatureState(
    context.transaction,
    context.auth.boxId,
    feature,
    context.now,
  );
  if (!state.effective.enabled) throw unprocessable('feature_not_included');
  const limit = state.effective.monthlyLimit;
  if (limit !== null && state.usedThisMonth >= limit) throw unprocessable('feature_limit_reached');
  return state;
}

export interface AiUsageEntry {
  feature: FeatureFlag;
  provider: (typeof aiUsage.$inferInsert)['provider'];
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** One provider call, counted against the month even if the user discards the result. */
export async function recordAiUsage(context: ServiceContext, entry: AiUsageEntry): Promise<string> {
  const [row] = await context.transaction
    .insert(aiUsage)
    .values({
      boxId: context.auth.boxId,
      userId: context.auth.userId,
      ...entry,
      createdAt: context.now,
    })
    .returning({ id: aiUsage.id });
  if (!row) throw new Error('AI usage was not recorded');
  return row.id;
}
