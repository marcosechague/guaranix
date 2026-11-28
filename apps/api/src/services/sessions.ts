import { type SchemaDatabase, type ScopedTransaction, withSystemScope } from '@guaranix/db';
import {
  boxUsers,
  boxes,
  oauthAccounts,
  sessions,
  userCredentials,
  users,
} from '@guaranix/db/schema';
import type { Impersonation, Membership, Session } from '@guaranix/shared';
import { and, asc, eq, gt, isNull, ne } from 'drizzle-orm';
import type { AuthenticatedSession } from '../env';
import { hmacSha256, randomToken, sha256 } from '../lib/crypto';

export const SESSION_LIFETIME_SECONDS = 30 * 24 * 60 * 60;

export async function listMemberships(
  database: SchemaDatabase,
  userId: string,
): Promise<Membership[]> {
  return withSystemScope(database, (transaction) =>
    transaction
      .select({
        boxId: boxUsers.boxId,
        boxName: boxes.name,
        role: boxUsers.role,
        boxStatus: boxes.status,
      })
      .from(boxUsers)
      .innerJoin(boxes, eq(boxes.id, boxUsers.boxId))
      .where(and(eq(boxUsers.userId, userId), eq(boxUsers.isActive, true)))
      .orderBy(asc(boxUsers.createdAt)),
  );
}

/** Starts a session in the user's first box; returns the token for the cookie. */
export async function createSession(database: SchemaDatabase, userId: string): Promise<string> {
  const token = randomToken();
  const [firstMembership] = await listMemberships(database, userId);
  await withSystemScope(database, async (transaction) => {
    await transaction.insert(sessions).values({
      tokenHash: await sha256(token),
      userId,
      activeBoxId: firstMembership?.boxId ?? null,
      expiresAt: new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000),
    });
    await transaction.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  });
  return token;
}

export async function findSession(
  database: SchemaDatabase,
  token: string,
): Promise<AuthenticatedSession | null> {
  const tokenHash = await sha256(token);
  const [row] = await withSystemScope(database, (transaction) =>
    transaction
      .select({
        id: sessions.id,
        userId: sessions.userId,
        activeBoxId: sessions.activeBoxId,
        isPlatformAdmin: users.isPlatformAdmin,
        impersonatedBoxId: sessions.impersonatedBoxId,
        impersonationEndsAt: sessions.impersonationEndsAt,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      ),
  );
  if (!row) return null;
  const { impersonatedBoxId, impersonationEndsAt, ...session } = row;
  // Only a platform admin can impersonate, and only until the window closes.
  const impersonating =
    session.isPlatformAdmin &&
    impersonatedBoxId !== null &&
    impersonationEndsAt !== null &&
    impersonationEndsAt > new Date();
  return {
    ...session,
    token,
    impersonation: impersonating ? { boxId: impersonatedBoxId, endsAt: impersonationEndsAt } : null,
  };
}

export const IMPERSONATION_MINUTES = 60;

/** Points the session at `boxId` as its owner for an hour. The caller audits it. */
export async function startImpersonation(
  transaction: ScopedTransaction,
  sessionId: string,
  boxId: string,
  now: Date,
): Promise<Date> {
  const endsAt = new Date(now.getTime() + IMPERSONATION_MINUTES * 60_000);
  await transaction
    .update(sessions)
    .set({ impersonatedBoxId: boxId, impersonationEndsAt: endsAt })
    .where(eq(sessions.id, sessionId));
  return endsAt;
}

export async function endImpersonation(
  transaction: ScopedTransaction,
  sessionId: string,
): Promise<void> {
  await transaction
    .update(sessions)
    .set({ impersonatedBoxId: null, impersonationEndsAt: null })
    .where(eq(sessions.id, sessionId));
}

export async function revokeSession(database: SchemaDatabase, sessionId: string): Promise<void> {
  await withSystemScope(database, (transaction) =>
    transaction.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId)),
  );
}

/** Logs the user out everywhere, except `keepSessionId` when given. */
export async function revokeUserSessions(
  database: SchemaDatabase,
  userId: string,
  keepSessionId?: string,
): Promise<void> {
  await withSystemScope(database, (transaction) =>
    transaction
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          keepSessionId ? ne(sessions.id, keepSessionId) : undefined,
        ),
      ),
  );
}

/** Switches the session's box. Returns false if the user does not belong to it. */
export async function selectActiveBox(
  database: SchemaDatabase,
  session: AuthenticatedSession,
  boxId: string,
): Promise<boolean> {
  const memberships = await listMemberships(database, session.userId);
  if (!memberships.some((membership) => membership.boxId === boxId)) return false;
  await withSystemScope(database, (transaction) =>
    transaction.update(sessions).set({ activeBoxId: boxId }).where(eq(sessions.id, session.id)),
  );
  return true;
}

/** Ties the CSRF token to the session, so nothing extra needs storing. */
export function csrfTokenFor(secret: string, sessionToken: string): Promise<string> {
  return hmacSha256(secret, `csrf:${sessionToken}`);
}

/** What the apps need after login: who you are, how you sign in, and your boxes. */
export async function describeSession(
  database: SchemaDatabase,
  secret: string,
  token: string,
): Promise<Session | null> {
  const session = await findSession(database, token);
  if (!session) return null;
  const [user, memberships] = await Promise.all([
    withSystemScope(database, async (transaction) => {
      const [row] = await transaction
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          isPlatformAdmin: users.isPlatformAdmin,
          hasPassword: userCredentials.userId,
          googleLinked: oauthAccounts.id,
        })
        .from(users)
        .leftJoin(userCredentials, eq(userCredentials.userId, users.id))
        .leftJoin(
          oauthAccounts,
          and(eq(oauthAccounts.userId, users.id), eq(oauthAccounts.provider, 'google')),
        )
        .where(eq(users.id, session.userId));
      return row;
    }),
    listMemberships(database, session.userId),
  ]);
  if (!user) return null;
  const { hasPassword, googleLinked, ...profile } = user;
  const impersonation = await describeImpersonation(database, session);
  const activeBoxId = impersonation
    ? impersonation.boxId
    : memberships.some((membership) => membership.boxId === session.activeBoxId)
      ? session.activeBoxId
      : null;
  return {
    user: profile,
    hasPassword: hasPassword !== null,
    googleLinked: googleLinked !== null,
    memberships,
    activeBoxId,
    impersonation,
    csrfToken: await csrfTokenFor(secret, token),
  };
}

async function describeImpersonation(
  database: SchemaDatabase,
  session: AuthenticatedSession,
): Promise<Impersonation | null> {
  if (!session.impersonation) return null;
  const { boxId, endsAt } = session.impersonation;
  const [box] = await withSystemScope(database, (transaction) =>
    transaction.select({ name: boxes.name }).from(boxes).where(eq(boxes.id, boxId)),
  );
  return box ? { boxId, boxName: box.name, endsAt: endsAt.toISOString() } : null;
}
