import {
  addDays,
  normalizeMemberRow,
  normalizePlanRow,
  normalizeText,
  rangesOverlap,
  type DataImportInput,
  type ImportAnalysis,
  type ImportPlanOutcome,
  type ImportRowOutcome,
  type ImportSummary,
  type ImportedMember,
  type ImportedMemberPlan,
} from '@guaranix/shared';
import { contactKey, type BoxImportState } from './data-import-state';
import { matchExistingMember } from './data-import-matching';

/** A plan rows can point to: one the box has (`planId`) or one the sheet creates. */
interface PlanTerms {
  planId: string | null;
  durationDays: number;
  classCount: number | null;
}

interface PlanCatalog {
  terms: Map<string, PlanTerms>;
  invalidNames: Set<string>;
  outcomes: ImportPlanOutcome[];
}

function analyzePlans(input: DataImportInput, state: BoxImportState): PlanCatalog {
  const terms = new Map<string, PlanTerms>();
  for (const [name, plan] of state.plansByName) {
    terms.set(name, {
      planId: plan.id,
      durationDays: plan.durationDays,
      classCount: plan.classCount,
    });
  }
  const invalidNames = new Set<string>();
  const outcomes = input.plans.map((row, index): ImportPlanOutcome => {
    const { plan, errors } = normalizePlanRow(row);
    const key = normalizeText(row.name ?? '');
    if (!plan) {
      if (key && !state.plansByName.has(key)) invalidNames.add(key);
      return { index, name: row.name ?? null, status: 'invalid', errors, plan: null };
    }
    if (state.plansByName.has(key))
      return { index, name: plan.name, status: 'existing', errors, plan };
    if (terms.has(key)) {
      const duplicate = [{ field: 'name' as const, code: 'duplicate_in_file' as const }];
      return { index, name: plan.name, status: 'invalid', errors: duplicate, plan: null };
    }
    terms.set(key, { planId: null, durationDays: plan.durationDays, classCount: plan.classCount });
    return { index, name: plan.name, status: 'new', errors, plan };
  });
  return { terms, invalidNames, outcomes };
}

type Outcome = Pick<ImportRowOutcome, 'errors' | 'warnings'>;

/** Fills the missing date from the plan's duration and checks the credits left. */
function resolvePlan(
  requested: ImportedMemberPlan,
  catalog: PlanCatalog,
  today: string,
  outcome: Outcome,
): ImportRowOutcome['plan'] {
  const key = normalizeText(requested.planName);
  const terms = catalog.terms.get(key);
  if (!terms) {
    const code = catalog.invalidNames.has(key) ? 'plan_invalid' : 'plan_not_found';
    outcome.errors.push({ field: 'planName', code });
    return null;
  }
  const span = terms.durationDays - 1;
  const startsOn =
    requested.startsOn ?? (requested.endsOn ? addDays(requested.endsOn, -span) : null);
  const endsOn = requested.endsOn ?? (startsOn ? addDays(startsOn, span) : null);
  if (!startsOn || !endsOn) {
    outcome.errors.push({ field: 'planEndsOn', code: 'plan_dates_missing' });
    return null;
  }
  let classesRemaining = requested.classesRemaining;
  if (terms.classCount === null) {
    if (classesRemaining)
      outcome.errors.push({ field: 'classesRemaining', code: 'credits_not_allowed' });
    classesRemaining = null;
  } else if (classesRemaining === null) {
    outcome.warnings.push({ field: 'classesRemaining', code: 'credits_defaulted' });
    classesRemaining = terms.classCount;
  } else if (classesRemaining > terms.classCount) {
    outcome.errors.push({ field: 'classesRemaining', code: 'credits_exceed_plan' });
  }
  if (endsOn < today) outcome.warnings.push({ field: 'planEndsOn', code: 'plan_expired' });
  return { planName: requested.planName, startsOn, endsOn, classesRemaining };
}

/** Keys that identify the same person twice in one file. */
function identityKeys(member: ImportedMember): string[] {
  const keys: string[] = [];
  if (member.externalRef) keys.push(`ref:${member.externalRef}`);
  if (member.documentNumber) keys.push(`doc:${member.documentNumber}`);
  for (const contact of [member.email, member.phone]) {
    if (contact) keys.push(`contact:${contactKey(contact, member.firstName, member.lastName)}`);
  }
  return keys;
}

function analyzeRow(
  input: DataImportInput,
  index: number,
  state: BoxImportState,
  catalog: PlanCatalog,
  seen: Set<string>,
): ImportRowOutcome {
  const row = input.members[index] ?? {};
  const normalized = normalizeMemberRow(row);
  const outcome: Outcome = { errors: [...normalized.errors], warnings: [...normalized.warnings] };
  const { member } = normalized;
  let existingMemberId: string | null = null;
  if (member) {
    const keys = identityKeys(member);
    if (keys.some((key) => seen.has(key)))
      outcome.errors.push({ field: null, code: 'duplicate_in_file' });
    for (const key of keys) seen.add(key);
    const match = matchExistingMember(member, state);
    if (match.mismatch) outcome.errors.push({ field: 'documentNumber', code: 'identity_mismatch' });
    if (match.member) {
      existingMemberId = match.member.id;
      outcome.warnings.push({ field: null, code: 'member_exists' });
    }
  }
  let plan = normalized.plan && resolvePlan(normalized.plan, catalog, state.today, outcome);
  if (plan && existingMemberId) {
    const live = state.livePlansByMember.get(existingMemberId) ?? [];
    if (live.some((range) => rangesOverlap(range, plan as { startsOn: string; endsOn: string }))) {
      outcome.warnings.push({ field: 'planName', code: 'plan_already_present' });
      plan = null;
    }
  }
  let balance = normalized.balance && {
    amountGs: normalized.balance.amountGs,
    dueOn: normalized.balance.dueOn ?? state.today,
  };
  if (balance && existingMemberId && state.membersWithImportedBalance.has(existingMemberId)) {
    outcome.warnings.push({ field: 'balanceGs', code: 'balance_already_imported' });
    balance = null;
  }
  const status = outcome.errors.length > 0 ? 'invalid' : existingMemberId ? 'existing' : 'new';
  return {
    index,
    status,
    ...outcome,
    member,
    existingMemberId,
    plan: plan ?? null,
    balance: balance ?? null,
  };
}

function summarize(rows: ImportRowOutcome[], plans: ImportPlanOutcome[]): ImportSummary {
  const valid = rows.filter((row) => row.status !== 'invalid');
  return {
    rows: rows.length,
    invalidRows: rows.length - valid.length,
    membersCreated: valid.filter((row) => row.status === 'new').length,
    membersMatched: valid.filter((row) => row.status === 'existing').length,
    plansCreated: plans.filter((plan) => plan.status === 'new').length,
    memberPlansCreated: valid.filter((row) => row.plan).length,
    chargesCreated: valid.filter((row) => row.balance).length,
    balanceGs: valid.reduce((total, row) => total + (row.balance?.amountGs ?? 0), 0),
  };
}

/**
 * Checks every row against the box without writing anything. The preview
 * shows this, and the commit runs it again inside its own transaction so a
 * stale preview can never write something the box no longer allows.
 */
export function analyzeImport(input: DataImportInput, state: BoxImportState): ImportAnalysis {
  const catalog = analyzePlans(input, state);
  const seen = new Set<string>();
  const rows = input.members.map((_row, index) => analyzeRow(input, index, state, catalog, seen));
  return { rows, plans: catalog.outcomes, summary: summarize(rows, catalog.outcomes) };
}
