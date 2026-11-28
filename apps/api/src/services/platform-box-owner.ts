import { boxUsers, oauthAccounts, userCredentials, users } from '@guaranix/db/schema';
import type { ChangeBoxOwnerInput, OwnerAccessLink } from '@guaranix/shared';
import { and, asc, eq } from 'drizzle-orm';
import { unprocessable } from './errors';
import { issuePasswordResetToken } from './password-auth';
import { type PlatformContext, recordPlatformAudit } from './platform-context';
import { getPlatformBox, lockBox } from './platform-boxes';

/** Long enough to reach the owner by WhatsApp over a weekend, short enough to expire unused. */
export const OWNER_ACCESS_LINK_HOURS = 72;

/** Finds the owner's account by email, or creates one they claim with Google or an access link. */
export async function ownerAccount(context: PlatformContext, email: string, fullName: string) {
  const [existing] = await context.transaction
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));
  if (existing) return existing.id;
  const [created] = await context.transaction
    .insert(users)
    .values({ email, fullName })
    .returning({ id: users.id });
  if (!created) throw new Error('User insert returned no row');
  return created.id;
}

async function currentOwners(context: PlatformContext, boxId: string) {
  return context.transaction
    .select({ userId: users.id, email: users.email })
    .from(boxUsers)
    .innerJoin(users, eq(users.id, boxUsers.userId))
    .where(and(eq(boxUsers.boxId, boxId), eq(boxUsers.role, 'box_owner')))
    .orderBy(asc(boxUsers.createdAt));
}

/**
 * Moves the owner role to the account with this email (created if new) and
 * takes it from whoever had it. If the new owner already worked at the box,
 * their role is raised to owner.
 */
export async function changeBoxOwner(
  context: PlatformContext,
  boxId: string,
  input: ChangeBoxOwnerInput,
) {
  await lockBox(context, boxId);
  const before = await currentOwners(context, boxId);
  const ownerUserId = await ownerAccount(context, input.ownerEmail, input.ownerName);
  if (before.length === 1 && before[0]?.userId === ownerUserId) {
    throw unprocessable('box_owner_unchanged');
  }
  await context.transaction
    .delete(boxUsers)
    .where(and(eq(boxUsers.boxId, boxId), eq(boxUsers.role, 'box_owner')));
  await context.transaction
    .insert(boxUsers)
    .values({ boxId, userId: ownerUserId, role: 'box_owner' })
    .onConflictDoUpdate({
      target: [boxUsers.boxId, boxUsers.userId],
      set: { role: 'box_owner' },
    });
  await recordPlatformAudit(context, {
    action: 'box.owner_changed',
    entityType: 'box',
    entityId: boxId,
    boxId,
    changes: {
      from: before.map((owner) => ({ userId: owner.userId, email: owner.email })),
      to: { userId: ownerUserId, email: input.ownerEmail },
    },
  });
  return getPlatformBox(context, boxId);
}

async function hasSignedIn(context: PlatformContext, userId: string) {
  const [password] = await context.transaction
    .select({ userId: userCredentials.userId })
    .from(userCredentials)
    .where(eq(userCredentials.userId, userId));
  if (password) return true;
  const [google] = await context.transaction
    .select({ id: oauthAccounts.id })
    .from(oauthAccounts)
    .where(eq(oauthAccounts.userId, userId));
  return Boolean(google);
}

/**
 * A one-time link for an owner without Google to create their password,
 * handed over by the superadmin outside email. Only for owners who never got
 * in: once an account is in use, only its owner may change how it signs in.
 */
export async function createOwnerAccessLink(
  context: PlatformContext,
  boxId: string,
): Promise<OwnerAccessLink> {
  await lockBox(context, boxId);
  const [owner] = await currentOwners(context, boxId);
  if (!owner) throw unprocessable('box_owner_missing');
  if (await hasSignedIn(context, owner.userId)) throw unprocessable('box_owner_already_active');
  const lifetimeMinutes = OWNER_ACCESS_LINK_HOURS * 60;
  const token = await issuePasswordResetToken(
    context.transaction,
    owner.userId,
    lifetimeMinutes,
    context.now,
  );
  const expiresAt = new Date(context.now.getTime() + lifetimeMinutes * 60 * 1000).toISOString();
  await recordPlatformAudit(context, {
    action: 'box.owner_access_link_created',
    entityType: 'box',
    entityId: boxId,
    boxId,
    changes: { ownerUserId: owner.userId, expiresAt },
  });
  return { token, expiresAt };
}
