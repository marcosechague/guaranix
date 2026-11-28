import type { IMPORT_SOURCES } from '../domain/enums';

export type ImportSource = (typeof IMPORT_SOURCES)[number];

/** Columns a member row can carry. `fullName` is split when there are no separate columns. */
export const MEMBER_IMPORT_FIELDS = [
  'firstName',
  'lastName',
  'fullName',
  'documentNumber',
  'email',
  'phone',
  'birthDate',
  'joinedOn',
  'status',
  'externalRef',
  'notes',
  'planName',
  'planStartsOn',
  'planEndsOn',
  'classesRemaining',
  'balanceGs',
  'balanceDueOn',
] as const;
export type MemberImportField = (typeof MEMBER_IMPORT_FIELDS)[number];

/** Columns of the optional plans sheet, for plans the box doesn't have yet. */
export const PLAN_IMPORT_FIELDS = [
  'name',
  'kind',
  'priceGs',
  'durationDays',
  'classesPerWeek',
  'classCount',
] as const;
export type PlanImportField = (typeof PLAN_IMPORT_FIELDS)[number];

/** Cell values as text, keyed by the field the column was mapped to. */
export type MemberImportRow = Partial<Record<MemberImportField, string>>;
export type PlanImportRow = Partial<Record<PlanImportField, string>>;

/** Enough for a box of any size in one go, small enough for one request. */
export const MAX_IMPORT_MEMBER_ROWS = 3000;
export const MAX_IMPORT_PLAN_ROWS = 200;

/**
 * Why a row can't be imported (error) or what will happen differently than
 * the file says (warning). Each code has its text under `imports.issues`.
 */
export const IMPORT_ISSUE_CODES = [
  'required',
  'invalid_date',
  'invalid_amount',
  'negative_amount',
  'invalid_number',
  'invalid_document',
  'invalid_email',
  'invalid_phone',
  'invalid_status',
  'invalid_plan_kind',
  'invalid_plan_limits',
  'too_long',
  'name_split',
  'identity_missing',
  'identity_mismatch',
  'duplicate_in_file',
  'member_exists',
  'plan_not_found',
  'plan_invalid',
  'plan_exists',
  'plan_dates_missing',
  'plan_dates_invalid',
  'plan_expired',
  'plan_already_present',
  'credits_not_allowed',
  'credits_exceed_plan',
  'credits_defaulted',
  'balance_already_imported',
] as const;
export type ImportIssueCode = (typeof IMPORT_ISSUE_CODES)[number];

export interface ImportIssue {
  field: MemberImportField | PlanImportField | null;
  code: ImportIssueCode;
}
