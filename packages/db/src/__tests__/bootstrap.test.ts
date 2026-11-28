import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { platformPlans, users } from '../schema';
import { withSystemScope } from '../scope';
import { bootstrapPlatform } from '../seed';
import { createTestDatabase } from '../testing/test-database';

let testDatabase: Awaited<ReturnType<typeof createTestDatabase>>;

// One database for the file (each PGlite instance is slow to start), so the
// cases run in order: first run, second run, an existing account, no email.
beforeAll(async () => {
  testDatabase = await createTestDatabase();
});

afterAll(async () => {
  await testDatabase.close();
});

const readAll = <T>(work: Parameters<typeof withSystemScope<T>>[1]) =>
  withSystemScope(testDatabase.database, work);

describe('bootstrapPlatform', () => {
  it('creates the plans and the platform admin on an empty database', async () => {
    const result = await bootstrapPlatform(testDatabase.database, {
      platformAdminEmail: ' Marcos@Example.COM ',
    });

    expect(result).toEqual({ plansInserted: 2, platformAdmin: 'created' });
    const plans = await readAll((tx) =>
      tx.select({ code: platformPlans.code }).from(platformPlans),
    );
    expect(plans.map((plan) => plan.code).sort()).toEqual(['base', 'founders']);
    const [admin] = await readAll((tx) =>
      tx.select().from(users).where(eq(users.email, 'marcos@example.com')),
    );
    expect(admin?.isPlatformAdmin).toBe(true);
    // No password and no verified email: the first login proves ownership of the address.
    expect(admin?.emailVerifiedAt).toBeNull();
  });

  it('is safe to run again and keeps the plans the superadmin edited', async () => {
    await bootstrapPlatform(testDatabase.database, { platformAdminEmail: 'marcos@example.com' });
    await readAll((tx) =>
      tx
        .update(platformPlans)
        .set({ monthlyPriceGs: 250_000 })
        .where(eq(platformPlans.code, 'base')),
    );

    const again = await bootstrapPlatform(testDatabase.database, {
      platformAdminEmail: 'marcos@example.com',
    });

    expect(again).toEqual({ plansInserted: 0, platformAdmin: 'unchanged' });
    const [base] = await readAll((tx) =>
      tx.select().from(platformPlans).where(eq(platformPlans.code, 'base')),
    );
    expect(base?.monthlyPriceGs).toBe(250_000);
    const admins = await readAll((tx) =>
      tx.select().from(users).where(eq(users.isPlatformAdmin, true)),
    );
    expect(admins).toHaveLength(1);
  });

  it('promotes an existing account instead of creating a second one', async () => {
    await readAll((tx) =>
      tx.insert(users).values({ email: 'coach@example.com', fullName: 'Coach Ana' }),
    );

    const result = await bootstrapPlatform(testDatabase.database, {
      platformAdminEmail: 'coach@example.com',
    });

    expect(result).toEqual({ plansInserted: 0, platformAdmin: 'promoted' });
    const accounts = await readAll((tx) =>
      tx.select().from(users).where(eq(users.email, 'coach@example.com')),
    );
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.isPlatformAdmin).toBe(true);
    expect(accounts[0]?.fullName).toBe('Coach Ana');
  });

  it('touches no account when no admin email is given', async () => {
    const before = await readAll((tx) => tx.select().from(users));

    const result = await bootstrapPlatform(testDatabase.database, {});

    expect(result).toEqual({ plansInserted: 0, platformAdmin: 'skipped' });
    const after = await readAll((tx) => tx.select().from(users));
    expect(after).toEqual(before);
  });

  it('rejects something that is not an email', async () => {
    await expect(
      bootstrapPlatform(testDatabase.database, { platformAdminEmail: 'not-an-email' }),
    ).rejects.toThrow(TypeError);
  });
});
