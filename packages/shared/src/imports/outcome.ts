import type { ImportIssue, ImportSource } from './fields';
import type { ImportedBalance, ImportedMember } from './member-row';
import type { ImportedPlan } from './plan-row';

/** `new` rows create a member; `existing` rows add a plan or balance to one the box already has. */
export type ImportRowStatus = 'new' | 'existing' | 'invalid';

export interface ImportRowOutcome {
  index: number;
  status: ImportRowStatus;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  member: ImportedMember | null;
  existingMemberId: string | null;
  /** The plan name as the file wrote it, also when it couldn't be found. */
  requestedPlanName: string | null;
  /** Dates filled in from the plan's duration; null when there is no plan or it is skipped. */
  plan: {
    planName: string;
    startsOn: string;
    endsOn: string;
    classesRemaining: number | null;
  } | null;
  /** Null when there is no balance or it was already imported. */
  balance: (ImportedBalance & { dueOn: string }) | null;
}

export interface ImportPlanOutcome {
  index: number;
  name: string | null;
  status: 'new' | 'existing' | 'invalid';
  errors: ImportIssue[];
  plan: ImportedPlan | null;
}

export interface ImportSummary {
  rows: number;
  invalidRows: number;
  membersCreated: number;
  membersMatched: number;
  plansCreated: number;
  memberPlansCreated: number;
  chargesCreated: number;
  balanceGs: number;
}

export interface ImportAnalysis {
  rows: ImportRowOutcome[];
  plans: ImportPlanOutcome[];
  summary: ImportSummary;
}

export interface DataImportRecord {
  id: string;
  fileName: string;
  source: ImportSource;
  summary: ImportSummary;
  createdByUserId: string | null;
  createdAt: string;
}
