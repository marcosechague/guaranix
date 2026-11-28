import {
  applyColumnMapping,
  normalizeText,
  suggestMemberColumns,
  suggestPlanColumns,
  type ColumnMapping,
  type DataImportRequest,
  type ImportSource,
  type MemberImportField,
  type PlanImportField,
} from '@guaranix/shared';
import type { SpreadsheetSheet } from './read-spreadsheet';

/** A file read in the browser plus how its columns feed the import. */
export interface ImportDraft {
  fileName: string;
  source: ImportSource;
  members: SpreadsheetSheet;
  plans: SpreadsheetSheet | null;
  memberMapping: ColumnMapping<MemberImportField>;
  planMapping: ColumnMapping<PlanImportField>;
}

const PLAN_SHEET = /\b(planes|plan|tarifas|tarifa|plans)\b/;
// Headers only CrossHero-style exports use together.
const CROSSHERO_HEADERS = ['apellidos', 'tarifa', 'sesiones restantes', 'fecha fin tarifa'];

export const headersOf = (sheet: SpreadsheetSheet | null): string[] => sheet?.rows[0] ?? [];

/** The plans sheet is the one named "Planes"/"Tarifas"; members are on the first other sheet with rows. */
export function pickSheets(sheets: SpreadsheetSheet[]) {
  const withRows = sheets.filter((sheet) => sheet.rows.length > 1);
  const plans =
    withRows.length > 1
      ? (withRows.find((sheet) => PLAN_SHEET.test(normalizeText(sheet.name))) ?? null)
      : null;
  const members = withRows.find((sheet) => sheet !== plans) ?? null;
  return { members, plans };
}

export function detectSource(headers: string[]): ImportSource {
  const normalized = new Set(headers.map(normalizeText));
  const hits = CROSSHERO_HEADERS.filter((header) => normalized.has(header)).length;
  return hits >= 2 ? 'crosshero' : 'spreadsheet';
}

export function createDraft(fileName: string, sheets: SpreadsheetSheet[]): ImportDraft | null {
  const { members, plans } = pickSheets(sheets);
  if (!members) return null;
  return {
    fileName,
    source: detectSource(headersOf(members)),
    members,
    plans,
    memberMapping: suggestMemberColumns(headersOf(members)),
    planMapping: suggestPlanColumns(headersOf(plans)),
  };
}

/** The spreadsheet line a member row came from: data starts on line 2, under the headers. */
export type LineNumbers = number[];

export function buildRequest(
  draft: ImportDraft,
  options: { balanceDescription: string; skipInvalidRows: boolean },
): { request: DataImportRequest; lines: LineNumbers } {
  const members = applyColumnMapping(draft.members.rows.slice(1), draft.memberMapping);
  const plans = draft.plans
    ? applyColumnMapping(draft.plans.rows.slice(1), draft.planMapping).rows
    : [];
  return {
    request: {
      fileName: draft.fileName,
      source: draft.source,
      balanceDescription: options.balanceDescription,
      skipInvalidRows: options.skipInvalidRows,
      members: members.rows,
      plans,
    },
    lines: members.sourceIndexes.map((index) => index + 2),
  };
}

export function mappedFieldCount(mapping: ColumnMapping<string>): number {
  return mapping.filter((field) => field !== null).length;
}

/** Without a name there is nothing to import, so the mapping step can't continue. */
export function mappingHasName(mapping: ColumnMapping<MemberImportField>): boolean {
  return mapping.includes('fullName') || mapping.includes('firstName');
}
