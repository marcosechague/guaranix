import type { members } from '@guaranix/db/schema';
import type { ImportedMember } from '@guaranix/shared';
import { contactKey, type BoxImportState } from './data-import-state';

type MemberRow = typeof members.$inferSelect;

/**
 * Finds the box member a row describes, strongest identifier first: the id
 * from the old system, the cédula, then email or phone together with the
 * name. `mismatch` flags a match whose cédula contradicts the row's, which
 * is more likely a typo than the same person.
 */
export function matchExistingMember(
  member: ImportedMember,
  state: BoxImportState,
): { member: MemberRow | null; mismatch: boolean } {
  const byContact = [member.email, member.phone]
    .filter((contact): contact is string => contact !== null)
    .map((contact) =>
      state.membersByContact.get(contactKey(contact, member.firstName, member.lastName)),
    );
  const candidates = [
    member.externalRef ? state.membersByExternalRef.get(member.externalRef) : undefined,
    member.documentNumber ? state.membersByDocument.get(member.documentNumber) : undefined,
    ...byContact,
  ];
  const found = candidates.find((candidate) => candidate !== undefined) ?? null;
  const mismatch =
    found !== null &&
    member.documentNumber !== null &&
    found.documentNumber !== null &&
    found.documentNumber !== member.documentNumber;
  return { member: mismatch ? null : found, mismatch };
}
