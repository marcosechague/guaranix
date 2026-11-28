import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { platformPlans, users } from '../schema';
import { withSystemScope } from '../scope';
import { bootstrapPlatform } from '../seed';
import { createTestDatabase } from '../testing/test-database';

let testDatabase: Awaited<ReturnType<typeof createTestDatabase>>;

beforeEach(async () => {
  testDatabase = await createTestDatabase();
});

afterEach(async () => {
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
      tx.insert(users).values({ email: 'marcos@example.com', fullName: 'Marcos' }),
    );

    const result = await bootstrapPlatform(testDatabase.database, {
      platformAdminEmail: 'marcos@example.com',
    });

    expect(result.platformAdmin).toBe('promoted');
    const [account] = await readAll((tx) =>
      tx.select().from(users).where(eq(users.email, 'marcos@example.com')),
    );
    expect(account?.isPlatformAdmin).toBe(true);
    expect(account?.fullName).toBe('Marcos');
  });

  it('only seeds the plans when no admin email is given', async () => {
    const result = await bootstrapPlatform(testDatabase.database, {});

    expect(result).toEqual({ plansInserted: 2, platformAdmin: 'skipped' });
    const admins = await readAll((tx) => tx.select().from(users));
    expect(admins).toHaveLength(0);
  });

  it('rejects something that is not an email', async () => {
    await expect(
      bootstrapPlatform(testDatabase.database, { platformAdminEmail: 'not-an-email' }),
    ).rejects.toThrow(TypeError);
  });
});
