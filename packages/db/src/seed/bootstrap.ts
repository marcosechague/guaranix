import { sql } from 'drizzle-orm';
import { platformPlans, users } from '../schema';
import { withSystemScope, type SchemaDatabase } from '../scope';
import { PLATFORM_PLAN_CATALOG } from './platform-catalog';

export interface BootstrapOptions {
  /** Person who runs GuaraniX. They log in with Google or "Olvidé mi contraseña". */
  platformAdminEmail?: string | undefined;
}

export interface BootstrapResult {
  plansInserted: number;
  platformAdmin: 'created' | 'promoted' | 'unchanged' | 'skipped';
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * What a fresh staging or production database needs before anyone can use it:
 * the platform plans and one platform admin. Safe to run on every deploy: it
 * never overwrites a plan the superadmin edited and never demotes anyone.
 */
export async function bootstrapPlatform(
  database: SchemaDatabase,
  options: BootstrapOptions,
): Promise<BootstrapResult> {
  const email = options.platformAdminEmail?.trim().toLowerCase() || undefined;
  if (email && !EMAIL.test(email)) throw new TypeError('platformAdminEmail is not an email');
  return withSystemScope(database, async (transaction) => {
    const inserted = await transaction
      .insert(platformPlans)
      .values([...PLATFORM_PLAN_CATALOG])
      .onConflictDoNothing({ target: platformPlans.code })
      .returning({ id: platformPlans.id });
    if (!email) return { plansInserted: inserted.length, platformAdmin: 'skipped' };

    const [admin] = await transaction
      .insert(users)
      .values({ email, fullName: email.split('@')[0] ?? email, isPlatformAdmin: true })
      .onConflictDoUpdate({
        target: users.email,
        set: { isPlatformAdmin: true, updatedAt: sql`now()` },
        setWhere: sql`${users.isPlatformAdmin} = false`,
      })
      // xmax = 0 only on a fresh insert: tells a new account from a promoted one.
      .returning({ created: sql<boolean>`(xmax = 0)` });
    const platformAdmin = !admin ? 'unchanged' : admin.created ? 'created' : 'promoted';
    return { plansInserted: inserted.length, platformAdmin };
  });
}
