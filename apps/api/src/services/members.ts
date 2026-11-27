import { and, asc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { members } from '@guaranix/db/schema';
import type { CreateMemberInput, UpdateMemberInput } from '@guaranix/shared/schemas';
import type { MemberStatus } from '@guaranix/shared/domain';
import { diff, recordAudit } from './audit';
import { conflict, forbidden, isUniqueViolation, notFound } from './errors';
import { isStaff, type ServiceContext } from './context';
import { definedFields } from './objects';

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
      ilike(members.documentNumber, pattern),
      ilike(members.email, pattern),
      ilike(members.phone, pattern),
    );
    if (matches) filters.push(matches);
  }
  return context.transaction
    .select()
    .from(members)
    .where(and(...filters))
    .orderBy(asc(members.lastName), asc(members.firstName), asc(members.id))
    .limit(query.limit)
    .offset(query.offset);
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

export async function createMember(
  context: ServiceContext,
  input: CreateMemberInput,
): Promise<MemberRow> {
  if (!isStaff(context.auth.role)) throw forbidden();
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
