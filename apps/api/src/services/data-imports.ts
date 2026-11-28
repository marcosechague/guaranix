import { desc, eq } from 'drizzle-orm';
import { dataImports } from '@guaranix/db/schema';
import type {
  DataImportInput,
  DataImportRecord,
  ImportAnalysis,
  ImportSummary,
} from '@guaranix/shared';
import { sha256 } from '../lib/crypto';
import { recordAudit } from './audit';
import { MANAGER_ROLES, assertRole, type ServiceContext } from './context';
import { analyzeImport } from './data-import-analysis';
import { loadBoxImportState } from './data-import-state';
import { writeImport } from './data-import-writes';
import { conflict, isUniqueViolation, notFound, unprocessable } from './errors';

type DataImportRow = typeof dataImports.$inferSelect;

function toRecord(row: DataImportRow): DataImportRecord {
  return {
    id: row.id,
    fileName: row.fileName,
    source: row.source,
    summary: row.summary as ImportSummary,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
  };
}

/** What committing would do, row by row. Writes nothing. Owners and admins only: it moves money. */
export async function previewImport(
  context: ServiceContext,
  input: DataImportInput,
): Promise<ImportAnalysis> {
  assertRole(context.auth.role, MANAGER_ROLES);
  return analyzeImport(input, await loadBoxImportState(context));
}

/** Identifies the rows, not the options, so re-sending them is recognized however it is sent. */
function payloadHash(input: DataImportInput): Promise<string> {
  return sha256(
    JSON.stringify({
      source: input.source,
      balanceDescription: input.balanceDescription,
      plans: input.plans,
      members: input.members,
    }),
  );
}

function hasErrors(analysis: ImportAnalysis): boolean {
  return (
    analysis.summary.invalidRows > 0 || analysis.plans.some((plan) => plan.status === 'invalid')
  );
}

function createsNothing(summary: ImportSummary): boolean {
  return (
    summary.membersCreated +
      summary.plansCreated +
      summary.memberPlansCreated +
      summary.chargesCreated ===
    0
  );
}

/**
 * Creates the members, plans, member plans and balance charges of a file in
 * one transaction. Sending the same rows again returns the first import
 * (`replayed`) instead of creating anything, and members the box already
 * has are matched instead of duplicated, so a corrected file can be sent again.
 */
export async function commitImport(
  context: ServiceContext,
  input: DataImportInput,
): Promise<{ import: DataImportRecord; analysis: ImportAnalysis | null; replayed: boolean }> {
  assertRole(context.auth.role, MANAGER_ROLES);
  const hash = await payloadHash(input);
  const [previous] = await context.transaction
    .select()
    .from(dataImports)
    .where(eq(dataImports.payloadHash, hash));
  if (previous) return { import: toRecord(previous), analysis: null, replayed: true };

  const state = await loadBoxImportState(context);
  const analysis = analyzeImport(input, state);
  if (hasErrors(analysis) && !input.skipInvalidRows) throw unprocessable('import_has_errors');
  if (createsNothing(analysis.summary)) throw unprocessable('import_empty');

  const [created] = await context.transaction
    .insert(dataImports)
    .values({
      boxId: context.auth.boxId,
      createdByUserId: context.auth.userId,
      fileName: input.fileName,
      source: input.source,
      payloadHash: hash,
      summary: analysis.summary,
    })
    .returning()
    .catch((error: unknown) => {
      // Two tabs committing the same file at once: the second one loses.
      if (isUniqueViolation(error)) throw conflict('import_in_progress');
      throw error;
    });
  if (!created) throw new Error('Import insert returned no row');
  await writeImport(context, created.id, input, analysis, state);
  // One entry for the whole import; each row it created carries `import_id`.
  await recordAudit(context, {
    action: 'data_import.committed',
    entityType: 'data_import',
    entityId: created.id,
    changes: { source: input.source, ...analysis.summary },
  });
  return { import: toRecord(created), analysis, replayed: false };
}

export async function listImports(context: ServiceContext): Promise<DataImportRecord[]> {
  assertRole(context.auth.role, MANAGER_ROLES);
  const rows = await context.transaction
    .select()
    .from(dataImports)
    .orderBy(desc(dataImports.createdAt))
    .limit(50);
  return rows.map(toRecord);
}

export async function getImport(
  context: ServiceContext,
  importId: string,
): Promise<DataImportRecord> {
  assertRole(context.auth.role, MANAGER_ROLES);
  const [row] = await context.transaction
    .select()
    .from(dataImports)
    .where(eq(dataImports.id, importId));
  if (!row) throw notFound('data_import');
  return toRecord(row);
}
