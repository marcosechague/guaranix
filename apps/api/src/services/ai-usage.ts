import type { AiProvider, AiUsage } from '@guaranix/ai';
import { type SchemaDatabase, withBoxScope, withSystemScope } from '@guaranix/db';
import { aiUsage } from '@guaranix/db/schema';
import type { FeatureFlag } from '@guaranix/shared/domain';
import { eq, sql } from 'drizzle-orm';
import type { ServiceAuth } from './context';
import { loadConfiguredProvider } from './ai-runtime';
import { ServiceError, unprocessable } from './errors';
import { assertFeatureAvailable, recordAiUsage } from './feature-access';
import type { AiRuntime } from './platform-ai';

/** The platform's configured provider; its settings and key are outside any box's scope. */
export function loadPlatformProvider(database: SchemaDatabase, ai: AiRuntime): Promise<AiProvider> {
  return withSystemScope(database, (transaction) =>
    loadConfiguredProvider(transaction, ai.secretsKey, ai.factory),
  );
}

/**
 * Checks the box's monthly limit for `feature` and counts one use, before the
 * provider is called: a failed or discarded answer still costs, so it still
 * counts. Returns the usage row to fill in with tokens afterwards.
 */
export async function reserveAiUse(
  database: SchemaDatabase,
  auth: ServiceAuth,
  now: Date,
  feature: FeatureFlag,
  provider: AiProvider,
): Promise<string> {
  return withBoxScope(database, { boxId: auth.boxId, userId: auth.userId }, async (transaction) => {
    const context = { transaction, auth, now };
    // Serializes check-and-count per box and feature, so parallel requests can't all pass the limit.
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`${feature}:${auth.boxId}`}))`,
    );
    await assertFeatureAvailable(context, feature);
    return recordAiUsage(context, {
      feature,
      provider: provider.name,
      model: provider.model,
      inputTokens: 0,
      outputTokens: 0,
    });
  });
}

/** Usage rows are append-only for the box role; the platform scope fills in the tokens. */
export async function completeAiUse(
  database: SchemaDatabase,
  usageId: string,
  result: { usage: AiUsage; model: string },
): Promise<void> {
  await withSystemScope(database, (transaction) =>
    transaction
      .update(aiUsage)
      .set({ ...result.usage, model: result.model })
      .where(eq(aiUsage.id, usageId)),
  );
}

// Key and model problems are the platform's to fix; box staff get a plain message instead.
const PLATFORM_SIDE = new Set([
  'ai_not_configured',
  'ai_secrets_key_missing',
  'ai_key_unreadable',
  'ai_key_rejected',
]);

/** Replaces platform-side AI errors with `unavailableCode`, which box staff can act on. */
export function forBoxStaff(error: unknown, unavailableCode: string): unknown {
  if (error instanceof ServiceError && PLATFORM_SIDE.has(error.code)) {
    return unprocessable(unavailableCode);
  }
  return error;
}
