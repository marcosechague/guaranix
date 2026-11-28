import { type SchemaDatabase, withSystemScope } from '@guaranix/db';
import { oauthAccounts, userCredentials, users } from '@guaranix/db/schema';
import { and, eq } from 'drizzle-orm';
import { canonicalAccountEmail } from '@guaranix/shared';
import type { GoogleIdentity } from '../integrations/google-oauth';
import { forgetNotificationAddresses, revokeUserSessions } from './sessions';

const PROVIDER = 'google';

export type GoogleSignInError = 'google_failed' | 'google_already_linked';

async function findLinkedUser(database: SchemaDatabase, subject: string) {
  const [account] = await withSystemScope(database, (transaction) =>
    transaction
      .select({ userId: oauthAccounts.userId })
      .from(oauthAccounts)
      .where(and(eq(oauthAccounts.provider, PROVIDER), eq(oauthAccounts.providerSubject, subject))),
  );
  return account?.userId ?? null;
}

/**
 * Logs in with Google, linking or creating the account by verified email.
 *
 * If the matching account's email was never verified, someone may have
 * registered it with a password before its real owner arrived ("pre-account
 * hijacking"). Google proves ownership now, so that password is removed and
 * every session is closed; the owner can create a new password afterwards.
 */
export async function signInWithGoogle(
  database: SchemaDatabase,
  identity: GoogleIdentity,
): Promise<{ userId: string } | { error: GoogleSignInError }> {
  const linkedUserId = await findLinkedUser(database, identity.subject);
  if (linkedUserId) return { userId: linkedUserId };
  if (!identity.email || !identity.emailVerified) return { error: 'google_failed' };
  const email = canonicalAccountEmail(identity.email);

  const outcome = await withSystemScope(database, async (transaction) => {
    const [existing] = await transaction
      .select({ id: users.id, emailVerifiedAt: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.email, email));
    const [existingGoogle] = existing
      ? await transaction
          .select({ id: oauthAccounts.id })
          .from(oauthAccounts)
          .where(and(eq(oauthAccounts.userId, existing.id), eq(oauthAccounts.provider, PROVIDER)))
      : [];
    if (existingGoogle) return { error: 'google_already_linked' as const };

    let userId = existing?.id;
    const wasUnverified = existing !== undefined && existing.emailVerifiedAt === null;
    if (!userId) {
      const fullName = identity.name?.trim() || email.split('@')[0] || email;
      const [created] = await transaction
        .insert(users)
        .values({ email, fullName, emailVerifiedAt: new Date() })
        .returning({ id: users.id });
      if (!created) throw new Error('User insert returned no row');
      userId = created.id;
    } else if (wasUnverified) {
      await transaction.delete(userCredentials).where(eq(userCredentials.userId, userId));
      await transaction
        .update(users)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(users.id, userId));
    }
    await transaction
      .insert(oauthAccounts)
      .values({ userId, provider: PROVIDER, providerSubject: identity.subject, email });
    return { userId, wasUnverified };
  });

  if ('error' in outcome) return outcome;
  if (outcome.wasUnverified) {
    await revokeUserSessions(database, outcome.userId);
    await forgetNotificationAddresses(database, outcome.userId);
  }
  return { userId: outcome.userId };
}

/** Links Google to a logged-in user. The Google email may differ from the account's. */
export async function linkGoogle(
  database: SchemaDatabase,
  userId: string,
  identity: GoogleIdentity,
): Promise<GoogleSignInError | null> {
  const linkedUserId = await findLinkedUser(database, identity.subject);
  if (linkedUserId === userId) return null;
  if (linkedUserId) return 'google_already_linked';
  const [existingGoogle] = await withSystemScope(database, (transaction) =>
    transaction
      .select({ id: oauthAccounts.id })
      .from(oauthAccounts)
      .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, PROVIDER))),
  );
  if (existingGoogle) return 'google_already_linked';
  await withSystemScope(database, (transaction) =>
    transaction.insert(oauthAccounts).values({
      userId,
      provider: PROVIDER,
      providerSubject: identity.subject,
      email: identity.email,
    }),
  );
  return null;
}

/** Refuses when Google is the only way the user can sign in. */
export async function unlinkGoogle(
  database: SchemaDatabase,
  userId: string,
): Promise<'last_sign_in_method' | null> {
  return withSystemScope(database, async (transaction) => {
    const [credentials] = await transaction
      .select({ userId: userCredentials.userId })
      .from(userCredentials)
      .where(eq(userCredentials.userId, userId));
    if (!credentials) return 'last_sign_in_method';
    await transaction
      .delete(oauthAccounts)
      .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, PROVIDER)));
    return null;
  });
}
