import type { MemberStatus } from '../domain/enums';
import {
  parseCountCell,
  parseDateCell,
  parseDocumentCell,
  parseEmailCell,
  parseGuaraniCell,
  parsePhoneCell,
  parseStatusCell,
} from './cells';
import type { ImportIssue, MemberImportField, MemberImportRow } from './fields';
import { RowReader } from './row-reader';

export interface ImportedMember {
  firstName: string;
  lastName: string;
  documentNumber: string | null;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  joinedOn: string | null;
  status: MemberStatus;
  externalRef: string | null;
  notes: string | null;
}

/** The plan the member has today in the old system. Missing dates are filled in by the API. */
export interface ImportedMemberPlan {
  planName: string;
  startsOn: string | null;
  endsOn: string | null;
  classesRemaining: number | null;
}

export interface ImportedBalance {
  amountGs: number;
  dueOn: string | null;
}

export interface NormalizedMemberRow {
  member: ImportedMember | null;
  plan: ImportedMemberPlan | null;
  balance: ImportedBalance | null;
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

/**
 * "Ana María Duarte Benítez" has two given names and two surnames; with
 * three words or fewer the first one is the given name.
 */
export function splitFullName(fullName: string): { firstName: string; lastName: string } | null {
  const words = fullName.split(' ').filter(Boolean);
  if (words.length < 2) return null;
  const given = words.length >= 4 ? 2 : 1;
  return { firstName: words.slice(0, given).join(' '), lastName: words.slice(given).join(' ') };
}

function readName(reader: RowReader<MemberImportField>) {
  const firstName = reader.text('firstName');
  const lastName = reader.text('lastName');
  if (firstName && lastName) return { firstName, lastName };
  const fullName = reader.text('fullName', 240) ?? (lastName ? null : firstName);
  const split = fullName ? splitFullName(fullName) : null;
  if (split) {
    reader.warn('fullName', 'name_split');
    return split;
  }
  reader.error(firstName ? 'lastName' : 'firstName', 'required');
  return null;
}

function readPlan(reader: RowReader<MemberImportField>): ImportedMemberPlan | null {
  const planName = reader.text('planName');
  const startsOn = reader.parsed('planStartsOn', parseDateCell);
  const endsOn = reader.parsed('planEndsOn', parseDateCell);
  const classesRemaining = reader.parsed('classesRemaining', parseCountCell);
  if (!planName) {
    if (startsOn || endsOn || classesRemaining !== null) reader.error('planName', 'required');
    return null;
  }
  if (startsOn && endsOn && endsOn < startsOn) reader.error('planEndsOn', 'plan_dates_invalid');
  return { planName, startsOn, endsOn, classesRemaining };
}

function readBalance(reader: RowReader<MemberImportField>): ImportedBalance | null {
  const amountGs = reader.parsed('balanceGs', parseGuaraniCell);
  const dueOn = reader.parsed('balanceDueOn', parseDateCell);
  return amountGs ? { amountGs, dueOn } : null;
}

/**
 * Reads one member row without touching the database. The API repeats this
 * and then checks the row against the box (existing members and plans).
 */
export function normalizeMemberRow(row: MemberImportRow): NormalizedMemberRow {
  const reader = new RowReader(row);
  const name = readName(reader);
  const member: ImportedMember | null = name && {
    ...name,
    documentNumber: reader.parsed('documentNumber', parseDocumentCell),
    email: reader.parsed('email', parseEmailCell),
    phone: reader.parsed('phone', parsePhoneCell),
    birthDate: reader.parsed('birthDate', parseDateCell),
    joinedOn: reader.parsed('joinedOn', parseDateCell),
    status: reader.parsed('status', parseStatusCell) ?? 'active',
    externalRef: reader.text('externalRef'),
    notes: reader.text('notes', 2000),
  };
  if (member && !member.documentNumber && !member.email && !member.phone && !member.externalRef) {
    reader.error('documentNumber', 'identity_missing');
  }
  const plan = readPlan(reader);
  const balance = readBalance(reader);
  return { member, plan, balance, errors: reader.errors, warnings: reader.warnings };
}
