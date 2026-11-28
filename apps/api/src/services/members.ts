import { and, asc, count, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { members } from '@guaranix/db/schema';
import type { CreateMemberInput, UpdateMemberInput } from '@guaranix/shared/schemas';
import type { MemberStatus } from '@guaranix/shared/domain';
import { diff, recordAudit } from './audit';
import { conflict, forbidden, isUniqueViolation, notFound } from './errors';
import { isStaff, type ServiceContext } from './context';
import { definedFields } from './objects';
import { assertLocationsExist } from './locations';

export type MemberRow = typeof members.$inferSelect;

export interface ListMembersQuery {
  search?: string | undefined;
  status?: MemberStatus | undefined;
  limit: number;
  offset: number;
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export async function listMembers(context: ServiceContext, query: ListMembersQuery) {
  const filters: SQL[] = [];
  if (query.status) filters.push(eq(members.status, query.status));
  const search = query.search?.trim();
  if (search) {
    const pattern = `%${escapeLike(search)}%`;
    const matches = or(
      ilike(members.firstName, pattern),
      ilike(members.lastName, pattern),
      ilike(sql`${members.firstName} || ' ' || ${members.lastName}`, pattern),
      // A coach can't see cédulas, so searching by one would leak them.
      canSeeDocument(context) ? ilike(members.documentNumber, pattern) : undefined,
      ilike(members.email, pattern),
      ilike(members.phone, pattern),
    );
    if (matches) filters.push(matches);
  }
  const rows = await context.transaction
    .select()
    .from(members)
    .where(and(...filters))
    .orderBy(asc(members.lastName), asc(members.firstName), asc(members.id))
    .limit(query.limit)
    .offset(query.offset);
  return rows.map((row) => memberForViewer(context, row));
}

/** Coaches don't handle identity documents; front desk and managers do. */
function canSeeDocument(context: ServiceContext): boolean {
  return context.auth.role !== 'coach';
}

/**
 * What the signed-in role may read of a member: a coach never gets the
 * cédula, and the member never gets the box's internal notes about them.
 */
export function memberForViewer(context: ServiceContext, member: MemberRow): MemberRow {
  if (context.auth.role === 'member') return { ...member, notes: null };
  if (!canSeeDocument(context)) return { ...member, documentNumber: null };
  return member;
}

/**
 * The member profile as the signed-in staff member or the member may see it.
 * When support opens it while "entering as" the box, that is logged for the
 * platform only: `support.*` entries are never shown to the box.
 */
export async function viewMember(context: ServiceContext, memberId: string): Promise<MemberRow> {
  const member = await getMember(context, memberId);
  if (context.auth.impersonatorUserId) {
    await recordAudit(context, {
      action: 'support.member_viewed',
      entityType: 'member',
      entityId: member.id,
    });
  }
  return memberForViewer(context, member);
}

/** The signed-in member's own profile, without the box's internal notes. */
export async function viewOwnMember(context: ServiceContext): Promise<MemberRow> {
  return memberForViewer(context, await getOwnMember(context));
}

/** Row Level Security already limits the count to the session's box. */
export async function countMembers(context: ServiceContext): Promise<number> {
  const [result] = await context.transaction.select({ total: count() }).from(members);
  return result?.total ?? 0;
}

/** Staff can open any member of the box; a member only their own profile. */
export async function getMember(context: ServiceContext, memberId: string): Promise<MemberRow> {
  const [member] = await context.transaction.select().from(members).where(eq(members.id, memberId));
  if (!member) throw notFound('member');
  if (!isStaff(context.auth.role) && member.userId !== context.auth.userId) {
    // Same answer as a missing member, so ids of other people can't be probed.
    throw notFound('member');
  }
  return member;
}

/** The member profile of the signed-in user in this box. */
export async function getOwnMember(context: ServiceContext): Promise<MemberRow> {
  const [member] = await context.transaction
    .select()
    .from(members)
    .where(eq(members.userId, context.auth.userId));
  if (!member) throw notFound('member');
  return member;
}

function translateUniqueViolation(error: unknown): never {
  if (isUniqueViolation(error)) throw conflict('member_document_taken');
  throw error;
}

async function assertHomeLocation(context: ServiceContext, locationId: string | null | undefined) {
  if (locationId) await assertLocationsExist(context, [locationId]);
}

export async function createMember(
  context: ServiceContext,
  input: CreateMemberInput,
): Promise<MemberRow> {
  if (!isStaff(context.auth.role)) throw forbidden();
  await assertHomeLocation(context, input.homeLocationId);
  const [member] = await context.transaction
    .insert(members)
    .values({ ...input, boxId: context.auth.boxId })
    .returning()
    .catch(translateUniqueViolation);
  if (!member) throw new Error('Member insert returned no row');
  await recordAudit(context, {
    action: 'member.created',
    entityType: 'member',
    entityId: member.id,
  });
  return member;
}

export async function updateMember(
  context: ServiceContext,
  memberId: string,
  input: UpdateMemberInput,
): Promise<MemberRow> {
  if (!isStaff(context.auth.role)) throw forbidden();
  const before = await getMember(context, memberId);
  const fields = definedFields(input);
  if (Object.keys(fields).length === 0) return before;
  await assertHomeLocation(context, fields.homeLocationId);
  const [member] = await context.transaction
    .update(members)
    .set(fields)
    .where(eq(members.id, memberId))
    .returning()
    .catch(translateUniqueViolation);
  if (!member) throw notFound('member');
  const changes = diff(before, fields);
  if (Object.keys(changes).length > 0) {
    // Medical notes are sensitive: log that they changed, not what they say.
    if (changes['medicalNotes']) changes['medicalNotes'] = { from: '[redacted]', to: '[redacted]' };
    await recordAudit(context, {
      action: 'member.updated',
      entityType: 'member',
      entityId: member.id,
      changes,
    });
  }
  return member;
}
