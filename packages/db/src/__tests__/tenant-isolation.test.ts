import { eq, getTableColumns, getTableName, sql } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../schema';
import { withBoxScope, withSystemScope } from '../scope';
import { seedDemoBox, seedPlatform } from '../seed';
import { createTestDatabase, rowsOf } from '../testing/test-database';

type TestDatabase = Awaited<ReturnType<typeof createTestDatabase>>;

const tenantTables = (Object.values(schema) as unknown[]).filter(
  (value): value is PgTable => value instanceof PgTable && 'boxId' in getTableColumns(value),
);

let testDatabase: TestDatabase;
let boxA: Awaited<ReturnType<typeof seedDemoBox>>;
let boxB: Awaited<ReturnType<typeof seedDemoBox>>;

beforeAll(async () => {
  testDatabase = await createTestDatabase();
  const platform = await seedPlatform(testDatabase.database);
  boxA = await seedDemoBox(testDatabase.database, {
    slug: 'box-a',
    platformPlanId: platform.basePlanId,
  });
  boxB = await seedDemoBox(testDatabase.database, {
    slug: 'box-b',
    platformPlanId: platform.basePlanId,
  });
  // Platform-only tables the demo seed leaves empty: one row per box so they are covered too.
  await withSystemScope(testDatabase.database, async (transaction) => {
    for (const box of [boxA, boxB]) {
      await transaction
        .insert(schema.boxFeatureOverrides)
        .values({ boxId: box.boxId, feature: 'ai_import', enabled: true, monthlyLimit: 5 });
      await transaction.insert(schema.aiUsage).values({
        boxId: box.boxId,
        userId: box.ownerId,
        feature: 'ai_import',
        provider: 'anthropic',
        model: 'claude-opus-5-5',
      });
      const [notification] = await transaction
        .insert(schema.notifications)
        .values({
          boxId: box.boxId,
          kind: 'workout_published',
          idempotencyKey: 'workout_published:test',
          audience: { type: 'active_members' },
          params: {},
        })
        .returning();
      await transaction.insert(schema.notificationDeliveries).values({
        boxId: box.boxId,
        notificationId: notification?.id ?? '',
        channel: 'push',
        recipientKey: `user:${box.ownerId}`,
        userId: box.ownerId,
        message: { title: 'WOD', body: 'Ya está' },
      });
      await seedCardPayment(transaction, box.boxId);
      await seedPlanLocation(transaction, box.boxId);
      await transaction.insert(schema.brodiMessages).values({
        boxId: box.boxId,
        userId: box.ownerId,
        role: 'user',
        content: '¿Cuánto cobré este mes?',
      });
      await transaction.insert(schema.brodiWeeklySummaries).values({
        boxId: box.boxId,
        weekStart: '2026-11-23',
        source: 'template',
        summary: 'Semana tranquila.',
        figures: {},
      });
      await transaction.insert(schema.staffArrivals).values({
        boxId: box.boxId,
        userId: box.ownerId,
        arrivedOn: '2026-11-28',
        arrivedAt: new Date('2026-11-28T10:00:00Z'),
      });
    }
  });
});

/** Restricts one plan to the box's default location, which the demo seed leaves open. */
async function seedPlanLocation(
  transaction: Parameters<Parameters<typeof withSystemScope>[1]>[0],
  boxId: string,
) {
  const [plan] = await transaction
    .select()
    .from(schema.plans)
    .where(eq(schema.plans.boxId, boxId))
    .limit(1);
  const [location] = await transaction
    .select()
    .from(schema.locations)
    .where(eq(schema.locations.boxId, boxId))
    .limit(1);
  if (!plan || !location) throw new Error('demo box has no plan or location');
  await transaction
    .insert(schema.planLocations)
    .values({ boxId, planId: plan.id, locationId: location.id });
}

/** One row of each card-payment table, which the demo seed leaves empty. */
async function seedCardPayment(
  transaction: Parameters<Parameters<typeof withSystemScope>[1]>[0],
  boxId: string,
) {
  const [charge] = await transaction
    .select()
    .from(schema.charges)
    .where(eq(schema.charges.boxId, boxId))
    .limit(1);
  if (!charge) throw new Error('demo box has no charges');
  const [account] = await transaction
    .insert(schema.paymentAccounts)
    .values({
      boxId,
      provider: 'mock',
      environment: 'sandbox',
      publicKey: 'public',
      encryptedPrivateKey: 'sealed',
      privateKeyHint: 'abcd',
    })
    .returning();
  if (!account) throw new Error('account not created');
  const memberId = charge.memberId;
  const [customer] = await transaction
    .insert(schema.paymentCustomers)
    .values({ boxId, accountId: account.id, memberId })
    .returning();
  if (!customer) throw new Error('customer not created');
  const [card] = await transaction
    .insert(schema.savedCards)
    .values({
      boxId,
      accountId: account.id,
      customerId: customer.id,
      memberId,
      autopayConsentAt: new Date(),
    })
    .returning();
  const [link] = await transaction
    .insert(schema.paymentLinks)
    .values({
      boxId,
      chargeId: charge.id,
      memberId,
      tokenHash: `hash-${boxId}`,
      expiresAt: new Date(),
    })
    .returning();
  await transaction.insert(schema.paymentAttempts).values({
    boxId,
    accountId: account.id,
    chargeId: charge.id,
    memberId,
    kind: 'autopay',
    savedCardId: card?.id,
    paymentLinkId: link?.id,
    amountGs: charge.amountGs,
  });
  await transaction.insert(schema.paymentEvents).values({
    boxId,
    accountId: account.id,
    provider: 'mock',
    type: 'webhook',
    signatureValid: false,
    outcome: 'rejected',
  });
}

afterAll(async () => {
  await testDatabase.close();
});

const asBoxA = <T>(work: Parameters<typeof withBoxScope<T>>[2]) =>
  withBoxScope(testDatabase.database, { boxId: boxA.boxId, userId: boxA.ownerId }, work);

describe('tenant tables', () => {
  it('covers every table with box data', () => {
    expect(tenantTables.map(getTableName).sort()).toMatchInlineSnapshot(`
      [
        "ai_usage",
        "audit_logs",
        "bookings",
        "box_feature_overrides",
        "box_users",
        "brodi_messages",
        "brodi_weekly_summaries",
        "charges",
        "class_schedules",
        "classes",
        "data_imports",
        "locations",
        "member_plans",
        "members",
        "movements",
        "notification_deliveries",
        "notifications",
        "payment_accounts",
        "payment_attempts",
        "payment_customers",
        "payment_events",
        "payment_links",
        "payments",
        "personal_records",
        "plan_locations",
        "plan_pauses",
        "plan_programs",
        "plans",
        "programs",
        "result_fist_bumps",
        "saved_cards",
        "staff_arrivals",
        "workout_components",
        "workout_results",
        "workouts",
      ]
    `);
  });

  it.each(tenantTables.map((table) => [getTableName(table), table] as const))(
    '%s: a box reads only its own rows',
    async (_name, table) => {
      const [all, scoped] = await Promise.all([
        withSystemScope(testDatabase.database, (transaction) => transaction.select().from(table)),
        asBoxA((transaction) => transaction.select().from(table)),
      ]);
      const boxIds = (rows: Record<string, unknown>[]) => new Set(rows.map((row) => row['boxId']));
      expect(boxIds(all)).toEqual(new Set([boxA.boxId, boxB.boxId]));
      expect(boxIds(scoped)).toEqual(new Set([boxA.boxId]));
    },
  );

  it.each(tenantTables.map((table) => [getTableName(table), table] as const))(
    "%s: a box cannot update or delete another box's rows",
    async (_name, table) => {
      const boxId = getTableColumns(table)['boxId'];
      if (!boxId) throw new Error('tenant table without boxId');
      const affected = await asBoxA(async (transaction) => {
        const updated = await transaction
          .update(table)
          // The table is only known at runtime, so its typed `set` shape is not.
          .set({ boxId: boxA.boxId } as never)
          .where(eq(boxId, boxB.boxId))
          .returning();
        const deleted = await transaction.delete(table).where(eq(boxId, boxB.boxId)).returning();
        return updated.length + deleted.length;
      }).catch((error: unknown) => {
        // Append-only tables (audit log, notifications) have no UPDATE/DELETE grant, which is even stricter.
        expect(String((error as { cause?: unknown }).cause ?? error)).toMatch(/permission denied/);
        return 0;
      });
      expect(affected).toBe(0);
    },
  );
});

describe('writes across boxes', () => {
  it("rejects inserting rows tagged with another box's id", async () => {
    await expect(
      asBoxA((transaction) =>
        transaction.insert(schema.programs).values({ boxId: boxB.boxId, name: 'Intruso' }),
      ),
    ).rejects.toThrow();
  });

  it('rejects references to rows of another box, even without RLS', async () => {
    await expect(
      withSystemScope(testDatabase.database, async (transaction) => {
        const [foreignClass] = await transaction
          .select()
          .from(schema.classes)
          .where(eq(schema.classes.boxId, boxB.boxId))
          .limit(1);
        const [ownMember] = await transaction
          .select()
          .from(schema.members)
          .where(eq(schema.members.boxId, boxA.boxId))
          .limit(1);
        await transaction.insert(schema.bookings).values({
          boxId: boxA.boxId,
          classId: foreignClass?.id ?? '',
          memberId: ownMember?.id ?? '',
          status: 'booked',
        });
      }),
    ).rejects.toThrow();
  });
});

describe('scope boundaries', () => {
  it('sees nothing when the app role runs without a box', async () => {
    const rows = await withSystemScope(testDatabase.database, async (transaction) => {
      await transaction.execute(sql`set local role guaranix_app`);
      return transaction.select().from(schema.members);
    });
    expect(rows).toEqual([]);
  });

  it('does not leak the scope to the next transaction on the connection', async () => {
    await asBoxA((transaction) => transaction.select().from(schema.members));
    const result = await withSystemScope(testDatabase.database, (transaction) =>
      transaction.execute(
        sql`select current_user as role, nullif(current_setting('app.box_id', true), '') as box`,
      ),
    );
    const [row] = rowsOf<{ role: string; box: string | null }>(result);
    expect(row?.role).not.toBe('guaranix_app');
    expect(row?.box).toBeNull();
  });

  it('refuses box ids that are not UUIDs', async () => {
    await expect(
      withBoxScope(testDatabase.database, { boxId: "' or true --" }, async () => undefined),
    ).rejects.toThrow(TypeError);
  });
});
