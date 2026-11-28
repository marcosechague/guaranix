import { type SchemaDatabase, withSystemScope } from '@guaranix/db';
import { passwordResetTokens, sessions, userCredentials, users } from '@guaranix/db/schema';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { randomToken, sha256 } from '../lib/crypto';
import { hashPassword, needsRehash, verifyAgainstDummy, verifyPassword } from '../lib/password';
import { forgetNotificationAddresses, revokeUserSessions } from './sessions';

export const RESET_TOKEN_LIFETIME_MINUTES = 30;

const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  const candidates = [error, (error as { cause?: unknown } | null)?.cause];
  return candidates.some(
    (candidate) => (candidate as { code?: unknown } | null)?.code === UNIQUE_VIOLATION,
  );
}

async function findUserByEmail(database: SchemaDatabase, email: string) {
  const [user] = await withSystemScope(database, (transaction) =>
    transaction
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(eq(users.email, email)),
  );
  return user ?? null;
}

async function storePassword(
  database: SchemaDatabase,
  userId: string,
  password: string,
  pepper: string,
) {
  const passwordHash = await hashPassword(password, pepper);
  await withSystemScope(database, (transaction) =>
    transaction
      .insert(userCredentials)
      .values({ userId, passwordHash })
      .onConflictDoUpdate({ target: userCredentials.userId, set: { passwordHash } }),
  );
}

export interface SignupInput {
  fullName: string;
  email: string;
  password: string;
}

/** Creates a user with a password. The email stays unverified until a reset link or Google proves it. */
export async function signup(
  database: SchemaDatabase,
  pepper: string,
  input: SignupInput,
): Promise<{ userId: string } | { error: 'email_taken' }> {
  const passwordHash = await hashPassword(input.password, pepper);
  try {
    const userId = await withSystemScope(database, async (transaction) => {
      const [user] = await transaction
        .insert(users)
        .values({ email: input.email, fullName: input.fullName })
        .returning({ id: users.id });
      if (!user) throw new Error('User insert returned no row');
      await transaction.insert(userCredentials).values({ userId: user.id, passwordHash });
      return user.id;
    });
    return { userId };
  } catch (error) {
    if (isUniqueViolation(error)) return { error: 'email_taken' };
    throw error;
  }
}

/** Returns the user id when email and password match. */
export async function login(
  database: SchemaDatabase,
  pepper: string,
  email: string,
  password: string,
): Promise<string | null> {
  const [row] = await withSystemScope(database, (transaction) =>
    transaction
      .select({ userId: users.id, passwordHash: userCredentials.passwordHash })
      .from(users)
      .innerJoin(userCredentials, eq(userCredentials.userId, users.id))
      .where(eq(users.email, email)),
  );
  if (!row) return verifyAgainstDummy(password, pepper).then(() => null);
  if (!(await verifyPassword(password, row.passwordHash, pepper))) return null;
  if (needsRehash(row.passwordHash)) await storePassword(database, row.userId, password, pepper);
  return row.userId;
}

/**
 * Creates a reset link token for the email's user, replacing older ones.
 * Returns null for unknown emails; callers answer the same either way.
 */
export async function createPasswordReset(database: SchemaDatabase, email: string) {
  const user = await findUserByEmail(database, email);
  if (!user) return null;
  const token = randomToken();
  await withSystemScope(database, async (transaction) => {
    await transaction
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));
    await transaction.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: await sha256(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_LIFETIME_MINUTES * 60 * 1000),
    });
  });
  return { token, fullName: user.fullName };
}

/**
 * Spends a reset token: sets the password, marks the email verified (the
 * person opened a link sent to it) and logs every other browser out.
 */
export async function resetPassword(
  database: SchemaDatabase,
  pepper: string,
  token: string,
  password: string,
): Promise<string | null> {
  const tokenHash = await sha256(token);
  const passwordHash = await hashPassword(password, pepper);
  const userId = await withSystemScope(database, async (transaction) => {
    // The conditional update is what makes the token single-use under concurrency.
    const [spent] = await transaction
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      )
      .returning({ userId: passwordResetTokens.userId });
    if (!spent) return null;
    await transaction
      .insert(userCredentials)
      .values({ userId: spent.userId, passwordHash })
      .onConflictDoUpdate({ target: userCredentials.userId, set: { passwordHash } });
    await transaction
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(and(eq(users.id, spent.userId), isNull(users.emailVerifiedAt)));
    return spent.userId;
  });
  if (userId) {
    await revokeUserSessions(database, userId);
    await forgetNotificationAddresses(database, userId);
  }
  return userId;
}

export type SetPasswordError =
  'current_password_required' | 'invalid_credentials' | 'recent_sign_in_required';

/** How fresh a Google sign-in must be to add a first password to the account. */
export const RECENT_SIGN_IN_MINUTES = 10;

/**
 * A Google-only account has no password to confirm, so creating the first one
 * asks for a sign-in from the last few minutes instead: a stolen or forgotten
 * open session can't add a permanent way into the account.
 */
async function signedInRecently(database: SchemaDatabase, sessionId: string): Promise<boolean> {
  const [session] = await withSystemScope(database, (transaction) =>
    transaction
      .select({ createdAt: sessions.createdAt })
      .from(sessions)
      .where(eq(sessions.id, sessionId)),
  );
  if (!session) return false;
  return Date.now() - session.createdAt.getTime() <= RECENT_SIGN_IN_MINUTES * 60_000;
}

/** Changes the password, or creates one for an account that only used Google. */
export async function setPassword(
  database: SchemaDatabase,
  pepper: string,
  input: { userId: string; sessionId: string; currentPassword?: string; newPassword: string },
): Promise<SetPasswordError | null> {
  const [existing] = await withSystemScope(database, (transaction) =>
    transaction
      .select({ passwordHash: userCredentials.passwordHash })
      .from(userCredentials)
      .where(eq(userCredentials.userId, input.userId)),
  );
  if (existing) {
    if (!input.currentPassword) return 'current_password_required';
    const matches = await verifyPassword(input.currentPassword, existing.passwordHash, pepper);
    if (!matches) return 'invalid_credentials';
  } else if (!(await signedInRecently(database, input.sessionId))) {
    return 'recent_sign_in_required';
  }
  await storePassword(database, input.userId, input.newPassword, pepper);
  await revokeUserSessions(database, input.userId, input.sessionId);
  return null;
}
