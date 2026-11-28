import { PLAN_KINDS, type MemberStatus, type PlanKind } from '../domain/enums';
import { documentNumberSchema, emailSchema, phoneE164Schema } from '../schemas/common';
import type { ImportIssueCode } from './fields';
import { normalizeText } from './text';

/** A parsed cell, or the issue that explains why it couldn't be read. */
export type CellResult<T> = { ok: true; value: T } | { ok: false; code: ImportIssueCode };

const ok = <T>(value: T): CellResult<T> => ({ ok: true, value });
const fail = <T>(code: ImportIssueCode): CellResult<T> => ({ ok: false, code });

/**
 * Whole guaraníes from how people write them: `₲ 300.000`, `300.000 Gs`,
 * `300000`, `300,000` or a spreadsheet number like `300000.00`.
 */
export function parseGuaraniCell(text: string): CellResult<number> {
  const compact = text.replace(/₲|gs\.?|pyg/gi, '').replace(/[\s\u00a0]/g, '');
  if (compact.startsWith('-')) return fail('negative_amount');
  let digits: string | null = null;
  if (/^\d+$/.test(compact)) digits = compact;
  else if (/^\d{1,3}(\.\d{3})+$/.test(compact)) digits = compact.replaceAll('.', '');
  else if (/^\d{1,3}(,\d{3})+$/.test(compact)) digits = compact.replaceAll(',', '');
  else if (/^\d+[.,]0{1,2}$/.test(compact)) digits = compact.replace(/[.,]0+$/, '');
  if (digits === null) return fail('invalid_amount');
  const amount = Number(digits);
  return Number.isSafeInteger(amount) ? ok(amount) : fail('invalid_amount');
}

/** A non-negative whole number, also when a spreadsheet wrote it as `10.0`. */
export function parseCountCell(text: string): CellResult<number> {
  const match = /^(\d{1,6})(?:[.,]0+)?$/.exec(text.trim());
  return match ? ok(Number(match[1])) : fail('invalid_number');
}

function isoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1) return null;
  if (date.getUTCDate() !== day || year < 1900 || year > 2200) return null;
  return date.toISOString().slice(0, 10);
}

// Day 0 of spreadsheet serial dates (Excel and Google Sheets).
const SPREADSHEET_EPOCH_MS = Date.UTC(1899, 11, 30, 12);

/**
 * Calendar dates as `YYYY-MM-DD`. Accepts ISO dates (with or without time),
 * the day-first formats used in Paraguay (`31/12/2026`, `31-12-26`,
 * `31.12.2026`) and spreadsheet serial numbers.
 */
export function parseDateCell(text: string): CellResult<string> {
  const value = text.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(value);
  if (iso) {
    const date = isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    return date ? ok(date) : fail('invalid_date');
  }
  const dayFirst = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(value);
  if (dayFirst) {
    const shortYear = Number(dayFirst[3]);
    const year =
      dayFirst[3]?.length === 2 ? (shortYear >= 50 ? 1900 : 2000) + shortYear : shortYear;
    const date = isoDate(year, Number(dayFirst[2]), Number(dayFirst[1]));
    return date ? ok(date) : fail('invalid_date');
  }
  if (/^\d{5}$/.test(value)) {
    const date = new Date(SPREADSHEET_EPOCH_MS + Number(value) * 86_400_000);
    return ok(date.toISOString().slice(0, 10));
  }
  return fail('invalid_date');
}

/** Cédula without dots or dashes: `1.234.567` → `1234567`. */
export function parseDocumentCell(text: string): CellResult<string> {
  const result = documentNumberSchema.safeParse(text.replace(/[.\s-]/g, ''));
  return result.success ? ok(result.data) : fail('invalid_document');
}

export function parseEmailCell(text: string): CellResult<string> {
  const result = emailSchema.safeParse(text);
  return result.success ? ok(result.data) : fail('invalid_email');
}

/** Paraguayan numbers to E.164: `0981 123 456`, `981123456` and `595981123456` all work. */
export function parsePhoneCell(text: string): CellResult<string> {
  let digits = text.replace(/[\s().-]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  else if (/^0\d{8,9}$/.test(digits)) digits = `595${digits.slice(1)}`;
  else if (/^9\d{8}$/.test(digits)) digits = `595${digits}`;
  const result = phoneE164Schema.safeParse(`+${digits}`);
  return result.success ? ok(result.data) : fail('invalid_phone');
}

const STATUS_WORDS: Record<string, MemberStatus> = {
  activo: 'active',
  activa: 'active',
  active: 'active',
  alta: 'active',
  si: 'active',
  inactivo: 'inactive',
  inactiva: 'inactive',
  inactive: 'inactive',
  baja: 'inactive',
  'de baja': 'inactive',
  no: 'inactive',
};

export function parseStatusCell(text: string): CellResult<MemberStatus> {
  const status = STATUS_WORDS[normalizeText(text)];
  return status ? ok(status) : fail('invalid_status');
}

// Checked in order: "clase suelta" must win over the generic "clases" of a pack.
const PLAN_KIND_PATTERNS: [RegExp, PlanKind][] = [
  [/\b(drop ?in|suelta|individual|dia|diaria)\b/, 'drop_in'],
  [/\b(ilimitad[oa]|libre|unlimited|open)\b/, 'unlimited'],
  [/\b(semana|semanal|weekly|x ?sem)\b/, 'weekly_limit'],
  [/\b(pack|paquete|bono|class ?pack|clases|sesiones)\b/, 'class_pack'],
];

/** Plan kinds as boxes name them: "Ilimitado", "3x semana", "Pack 10 clases", "Clase suelta". */
export function parsePlanKindCell(text: string): CellResult<PlanKind> {
  const normalized = normalizeText(text).replaceAll('_', ' ');
  const exact = PLAN_KINDS.find((kind) => kind.replace('_', ' ') === normalized);
  if (exact) return ok(exact);
  for (const [pattern, kind] of PLAN_KIND_PATTERNS) if (pattern.test(normalized)) return ok(kind);
  return fail('invalid_plan_kind');
}
