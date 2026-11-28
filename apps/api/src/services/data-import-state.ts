import { and, inArray, isNotNull, isNull } from 'drizzle-orm';
import { charges, memberPlans, members, plans } from '@guaranix/db/schema';
import { normalizeText } from '@guaranix/shared';
import { boxToday } from './box-calendar';
import type { ServiceContext } from './context';

type MemberRow = typeof members.$inferSelect;
type PlanRow = typeof plans.$inferSelect;
export type LivePlanRange = { startsOn: string; endsOn: string };

/** What the box already has, loaded once so every row is checked against the same picture. */
export interface BoxImportState {
  today: string;
  plansByName: Map<string, PlanRow>;
  membersByExternalRef: Map<string, MemberRow>;
  membersByDocument: Map<string, MemberRow>;
  /** `email|full name` and `phone|full name`: families often share a phone or an email. */
  membersByContact: Map<string, MemberRow>;
  livePlansByMember: Map<string, LivePlanRange[]>;
  membersWithImportedBalance: Set<string>;
}

export function personKey(firstName: string, lastName: string): string {
  return normalizeText(`${firstName} ${lastName}`);
}

export function contactKey(contact: string, firstName: string, lastName: string): string {
  return `${contact}|${personKey(firstName, lastName)}`;
}

function indexPlans(rows: PlanRow[]): Map<string, PlanRow> {
  const byName = new Map<string, PlanRow>();
  // Active plans win over retired ones with the same name.
  for (const plan of [...rows].sort(
    (first, second) => Number(first.isActive) - Number(second.isActive),
  )) {
    byName.set(normalizeText(plan.name), plan);
  }
  return byName;
}

function indexMembers(rows: MemberRow[]) {
  const byExternalRef = new Map<string, MemberRow>();
  const byDocument = new Map<string, MemberRow>();
  const byContact = new Map<string, MemberRow>();
  for (const member of rows) {
    if (member.externalRef) byExternalRef.set(member.externalRef, member);
    if (member.documentNumber) byDocument.set(member.documentNumber, member);
    for (const contact of [member.email, member.phone]) {
      if (contact) byContact.set(contactKey(contact, member.firstName, member.lastName), member);
    }
  }
  return { byExternalRef, byDocument, byContact };
}

/** Row Level Security keeps every one of these queries inside the session's box. */
export async function loadBoxImportState(context: ServiceContext): Promise<BoxImportState> {
  const [planRows, memberRows, liveRows, balanceRows, today] = await Promise.all([
    context.transaction.select().from(plans),
    context.transaction.select().from(members),
    context.transaction
      .select({
        memberId: memberPlans.memberId,
        startsOn: memberPlans.startsOn,
        endsOn: memberPlans.endsOn,
      })
      .from(memberPlans)
      .where(inArray(memberPlans.status, ['active', 'paused'])),
    context.transaction
      .selectDistinct({ memberId: charges.memberId })
      .from(charges)
      .where(and(isNotNull(charges.importId), isNull(charges.memberPlanId))),
    boxToday(context),
  ]);
  const indexed = indexMembers(memberRows);
  const livePlansByMember = new Map<string, LivePlanRange[]>();
  for (const row of liveRows) {
    livePlansByMember.set(row.memberId, [...(livePlansByMember.get(row.memberId) ?? []), row]);
  }
  return {
    today,
    plansByName: indexPlans(planRows),
    membersByExternalRef: indexed.byExternalRef,
    membersByDocument: indexed.byDocument,
    membersByContact: indexed.byContact,
    livePlansByMember,
    membersWithImportedBalance: new Set(balanceRows.map((row) => row.memberId)),
  };
}
