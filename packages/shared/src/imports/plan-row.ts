import type { PlanKind } from '../domain/enums';
import { planLimitIssues } from '../schemas/plan';
import { parseCountCell, parseGuaraniCell, parsePlanKindCell } from './cells';
import type { ImportIssue, PlanImportRow } from './fields';
import { RowReader } from './row-reader';

export interface ImportedPlan {
  name: string;
  kind: PlanKind;
  priceGs: number;
  durationDays: number;
  classesPerWeek: number | null;
  classCount: number | null;
}

export interface NormalizedPlanRow {
  plan: ImportedPlan | null;
  errors: ImportIssue[];
}

const DROP_IN_CLASSES = 1;

/** Reads one row of the plans sheet, with the same limits a plan created by hand has. */
export function normalizePlanRow(row: PlanImportRow): NormalizedPlanRow {
  const reader = new RowReader(row);
  const name = reader.text('name');
  if (!name) reader.error('name', 'required');
  const kind = reader.parsed('kind', parsePlanKindCell);
  if (!kind && !row.kind) reader.error('kind', 'required');
  const priceGs = reader.parsed('priceGs', parseGuaraniCell);
  if (priceGs === null && !row.priceGs) reader.error('priceGs', 'required');
  const durationDays = reader.parsed('durationDays', parseCountCell);
  if (durationDays === null && !row.durationDays) reader.error('durationDays', 'required');
  if (durationDays !== null && (durationDays < 1 || durationDays > 366)) {
    reader.error('durationDays', 'invalid_number');
  }
  const classesPerWeek =
    kind === 'weekly_limit' ? reader.parsed('classesPerWeek', parseCountCell) : null;
  const classCount =
    kind === 'drop_in'
      ? DROP_IN_CLASSES
      : kind === 'class_pack'
        ? reader.parsed('classCount', parseCountCell)
        : null;
  if (!name || !kind || priceGs === null || durationDays === null || reader.errors.length > 0) {
    return { plan: null, errors: reader.errors };
  }
  if (classesPerWeek !== null && classesPerWeek > 14)
    reader.error('classesPerWeek', 'invalid_number');
  if (classCount !== null && classCount > 500) reader.error('classCount', 'invalid_number');
  const plan = { name, kind, priceGs, durationDays, classesPerWeek, classCount };
  for (const issue of planLimitIssues(plan)) {
    reader.error(
      issue.path === 'classesPerWeek' ? 'classesPerWeek' : 'classCount',
      'invalid_plan_limits',
    );
  }
  return reader.errors.length > 0 ? { plan: null, errors: reader.errors } : { plan, errors: [] };
}
