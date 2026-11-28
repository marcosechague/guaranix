import { extractStructured } from '@guaranix/ai';
import type { SchemaDatabase } from '@guaranix/db';
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
import { z } from 'zod';
import { aiImportParts, AI_IMPORT_INSTRUCTIONS } from './ai-import-prompt';
import { callProvider } from './ai-runtime';
import { assertRole, MANAGER_ROLES, type ServiceAuth, type ServiceContext } from './context';
import { ServiceError, unprocessable } from './errors';
import { completeAiUse, forBoxStaff, loadPlatformProvider, reserveAiUse } from './ai-usage';
import { boxFeatureState } from './feature-access';
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
    const plain = forBoxStaff(error, 'ai_import_unavailable');
    if (plain instanceof ServiceError && plain.code === 'ai_request_rejected') {
      throw unprocessable('ai_file_rejected');
    }
    throw plain;
  }
}

async function extract(
  dependencies: AiImportDependencies,
  request: AiImportRequest,
): Promise<AiImportProposal> {
  const { database, auth, now, ai } = dependencies;
  assertRole(auth.role, MANAGER_ROLES);
  const input = aiImportRequestSchema.parse(request);
  const provider = await loadPlatformProvider(database, ai);
  const usageId = await reserveAiUse(database, auth, now, 'ai_import', provider);
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
  await completeAiUse(database, usageId, result);
  return {
    members: result.data.members.map(filledCells).filter(hasCells).slice(0, MAX_IMPORT_MEMBER_ROWS),
    plans: result.data.plans.map(filledCells).filter(hasCells).slice(0, MAX_IMPORT_PLAN_ROWS),
  };
}
