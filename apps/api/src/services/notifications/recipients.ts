import type { ScopedTransaction } from '@guaranix/db';
import { boxUsers, members, users } from '@guaranix/db/schema';
import type { NotificationAudience } from '@guaranix/shared';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';

export interface Recipient {
  /** Null for a member who never logged in: WhatsApp can still reach them. */
  userId: string | null;
  memberId: string | null;
  firstName: string;
  phone: string | null;
}

const memberColumns = {
  userId: members.userId,
  memberId: members.id,
  firstName: members.firstName,
  phone: members.phone,
};

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

async function staffOrUsers(
  transaction: ScopedTransaction,
  boxId: string,
  filter: ReturnType<typeof eq>,
): Promise<Recipient[]> {
  const rows = await transaction
    .select({ userId: boxUsers.userId, fullName: users.fullName })
    .from(boxUsers)
    .innerJoin(users, eq(users.id, boxUsers.userId))
    .where(and(eq(boxUsers.boxId, boxId), eq(boxUsers.isActive, true), filter));
  return rows.map((row) => ({
    userId: row.userId,
    memberId: null,
    firstName: firstNameOf(row.fullName),
    phone: null,
  }));
}

/**
 * Who an event reaches, read when it is expanded (not when it happened), so a
 * member who left the box in between is not notified. Every query names the
 * box: this runs outside box scope.
 */
export async function resolveRecipients(
  transaction: ScopedTransaction,
  boxId: string,
  audience: NotificationAudience,
): Promise<Recipient[]> {
  switch (audience.type) {
    case 'members':
      if (audience.memberIds.length === 0) return [];
      return transaction
        .select(memberColumns)
        .from(members)
        .where(
          and(
            eq(members.boxId, boxId),
            eq(members.status, 'active'),
            inArray(members.id, audience.memberIds),
          ),
        );
    case 'active_members':
      return transaction
        .select(memberColumns)
        .from(members)
        .where(
          and(eq(members.boxId, boxId), eq(members.status, 'active'), isNotNull(members.userId)),
        );
    case 'users':
      if (audience.userIds.length === 0) return [];
      return staffOrUsers(transaction, boxId, inArray(boxUsers.userId, audience.userIds));
    case 'staff':
      if (audience.roles.length === 0) return [];
      return staffOrUsers(transaction, boxId, inArray(boxUsers.role, audience.roles));
  }
}
