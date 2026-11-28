import { extractStructured } from '@guaranix/ai';
import { type SchemaDatabase, withBoxScope, withSystemScope } from '@guaranix/db';
import { aiUsage } from '@guaranix/db/schema';
import {
  type AiImportProposal,
  type AiImportRequest,
  aiImportRequestSchema,
  type AiImportStatus,
  MAX_IMPORT_MEMBER_ROWS,
  MAX_IMPORT_PLAN_ROWS,
  MEMBER_IMPORT_FIELDS,
  PLAN_IMPORT_FIELDS,
} from '@guaranix/shared';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { aiImportParts, AI_IMPORT_INSTRUCTIONS } from './ai-import-prompt';
import { callProvider, loadConfiguredProvider } from './ai-runtime';
import { assertRole, MANAGER_ROLES, type ServiceAuth, type ServiceContext } from './context';
import { ServiceError, unprocessable } from './errors';
import { assertFeatureAvailable, boxFeatureState, recordAiUsage } from './feature-access';
import type { AiRuntime } from './platform-ai';

/** Large enough for a few hundred rows; past that the admin is asked to split the file. */
const MAX_OUTPUT_TOKENS = 32_000;

const cell = z.string().max(2000).nullable();
const rowOf = <const Fields extends readonly string[]>(fields: Fields) =>
  z.object(
    Object.fromEntries(fields.map((field) => [field, cell])) as Record<Fields[number], typeof cell>,
  );

const proposalSchema = z.object({
  members: z.array(rowOf(MEMBER_IMPORT_FIELDS)),
  plans: z.array(rowOf(PLAN_IMPORT_FIELDS)),
});

/** Keeps the cells the model filled, trimmed, as the spreadsheet path would send them. */
function filledCells<T extends Record<string, string | null>>(
  row: T,
): Partial<Record<keyof T, string>> {
  const result: Partial<Record<keyof T, string>> = {};
  for (const [field, value] of Object.entries(row) as [keyof T, string | null][]) {
    const text = value?.trim();
    if (text) result[field] = text;
  }
  return result;
}

const hasCells = (row: object) => Object.keys(row).length > 0;

export async function aiImportStatus(context: ServiceContext): Promise<AiImportStatus> {
  assertRole(context.auth.role, MANAGER_ROLES);
  const state = await boxFeatureState(
    context.transaction,
    context.auth.boxId,
    'ai_import',
    context.now,
  );
  return { ...state.effective, usedThisMonth: state.usedThisMonth };
}

export interface AiImportDependencies {
  database: SchemaDatabase;
  auth: ServiceAuth;
  now: Date;
  ai: AiRuntime;
}

/**
 * Reads a file with the configured AI provider and proposes import rows. It
 * saves nothing but the use: the rows go to the normal preview, where the
 * admin edits or drops them before importing. No transaction stays open while
 * the provider works.
 */
export async function extractImportWithAi(
  dependencies: AiImportDependencies,
  request: AiImportRequest,
): Promise<AiImportProposal> {
  try {
    return await extract(dependencies, request);
  } catch (error) {
    throw error instanceof ServiceError ? forBoxStaff(error) : error;
  }
}

// Key and model problems are the platform's to fix; box staff get a plain message instead.
const PLATFORM_SIDE = new Set([
  'ai_not_configured',
  'ai_secrets_key_missing',
  'ai_key_unreadable',
  'ai_key_rejected',
]);

function forBoxStaff(error: ServiceError): ServiceError {
  if (PLATFORM_SIDE.has(error.code)) return unprocessable('ai_import_unavailable');
  if (error.code === 'ai_request_rejected') return unprocessable('ai_file_rejected');
  return error;
}

async function extract(
  dependencies: AiImportDependencies,
  request: AiImportRequest,
): Promise<AiImportProposal> {
  const { database, auth, now, ai } = dependencies;
  assertRole(auth.role, MANAGER_ROLES);
  const input = aiImportRequestSchema.parse(request);
  const provider = await withSystemScope(database, (transaction) =>
    loadConfiguredProvider(transaction, ai.secretsKey, ai.factory),
  );
  // The use is counted before the call, so a failed or discarded read still counts.
  const usageId = await withBoxScope(
    database,
    { boxId: auth.boxId, userId: auth.userId },
    async (transaction) => {
      const context = { transaction, auth, now };
      // Serializes check-and-count per box, so parallel requests can't all pass the monthly limit.
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`ai_import:${auth.boxId}`}))`,
      );
      await assertFeatureAvailable(context, 'ai_import');
      return recordAiUsage(context, {
        feature: 'ai_import',
        provider: provider.name,
        model: provider.model,
        inputTokens: 0,
        outputTokens: 0,
      });
    },
  );
  const result = await callProvider(() =>
    extractStructured(
      provider,
      {
        instructions: AI_IMPORT_INSTRUCTIONS,
        parts: aiImportParts(input),
        schemaName: 'member_import',
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
      proposalSchema,
    ),
  );
  // Usage rows are append-only for the box role; the platform scope fills in the tokens.
  await withSystemScope(database, (transaction) =>
    transaction
      .update(aiUsage)
      .set({ ...result.usage, model: result.model })
      .where(eq(aiUsage.id, usageId)),
  );
  return {
    members: result.data.members.map(filledCells).filter(hasCells).slice(0, MAX_IMPORT_MEMBER_ROWS),
    plans: result.data.plans.map(filledCells).filter(hasCells).slice(0, MAX_IMPORT_PLAN_ROWS),
  };
}
