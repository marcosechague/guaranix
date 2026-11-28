import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  aiUsage,
  auditLogs,
  boxes,
  boxFeatureOverrides,
  notificationDeliveries,
  notifications,
  platformPlanFeatures,
  platformPlans,
  users,
} from '../schema';
import { withBoxScope, withSystemScope } from '../scope';
import { seedDemoBox, seedPlatform } from '../seed';
import { createTestDatabase, rowsOf } from '../testing/test-database';

let testDatabase: Awaited<ReturnType<typeof createTestDatabase>>;
let boxA: Awaited<ReturnType<typeof seedDemoBox>>;
let boxB: Awaited<ReturnType<typeof seedDemoBox>>;

beforeAll(async () => {
  testDatabase = await createTestDatabase();
  await seedPlatform(testDatabase.database);
  boxA = await seedDemoBox(testDatabase.database, { slug: 'box-a', days: 1 });
  boxB = await seedDemoBox(testDatabase.database, { slug: 'box-b', days: 1 });
});

afterAll(async () => {
  await testDatabase.close();
});

const asBoxA = <T>(work: Parameters<typeof withBoxScope<T>>[2]) =>
  withBoxScope(testDatabase.database, { boxId: boxA.boxId, userId: boxA.ownerId }, work);

const permissionDenied = /permission denied/;
const causeOf = (promise: Promise<unknown>) =>
  promise.then(
    () => 'resolved',
    (error: { cause?: unknown }) => String(error.cause ?? error),
  );

describe('boxes', () => {
  it('a box sees only itself', async () => {
    const rows = await asBoxA((transaction) => transaction.select({ id: boxes.id }).from(boxes));
    expect(rows).toEqual([{ id: boxA.boxId }]);
  });

  it('a box can edit its profile but not its status or plan', async () => {
    await asBoxA((transaction) =>
      transaction.update(boxes).set({ city: 'Luque' }).where(eq(boxes.id, boxA.boxId)),
    );
    const status = asBoxA((transaction) =>
      transaction.update(boxes).set({ status: 'active' }).where(eq(boxes.id, boxA.boxId)),
    );
    expect(await causeOf(status)).toMatch(permissionDenied);
  });
});

describe('users', () => {
  it('a box sees only the people linked to it', async () => {
    const rows = await asBoxA((transaction) => transaction.select({ id: users.id }).from(users));
    expect(rows.map((row) => row.id).sort()).toEqual([boxA.ownerId, boxA.coachId].sort());
    expect(rows.map((row) => row.id)).not.toContain(boxB.ownerId);
  });

  it('nobody can make themselves platform admin from a box', async () => {
    const escalation = asBoxA((transaction) =>
      transaction.update(users).set({ isPlatformAdmin: true }).where(eq(users.id, boxA.ownerId)),
    );
    expect(await causeOf(escalation)).toMatch(permissionDenied);
  });

  it('a user can rename only themselves', async () => {
    const renamed = await asBoxA((transaction) =>
      transaction
        .update(users)
        .set({ fullName: 'Coach Renombrado' })
        .where(eq(users.id, boxA.coachId))
        .returning(),
    );
    expect(renamed).toEqual([]);
  });
});

describe('audit log', () => {
  it('is append-only for boxes', async () => {
    const update = asBoxA((transaction) => transaction.update(auditLogs).set({ action: 'x.y' }));
    const remove = asBoxA((transaction) => transaction.delete(auditLogs));
    expect(await causeOf(update)).toMatch(permissionDenied);
    expect(await causeOf(remove)).toMatch(permissionDenied);
  });

  it('does not accept entries for another box', async () => {
    const forged = asBoxA((transaction) =>
      transaction.insert(auditLogs).values({ boxId: boxB.boxId, action: 'x.y', entityType: 'x' }),
    );
    expect(await causeOf(forged)).toMatch(/row-level security/);
  });
});

describe('Brodi', () => {
  it.each(['brodi_messages', 'brodi_weekly_summaries'])(
    '%s is append-only for boxes',
    async (table) => {
      const update = asBoxA((transaction) =>
        transaction.execute(sql.raw(`update ${table} set updated_at = now()`)),
      );
      const remove = asBoxA((transaction) => transaction.execute(sql.raw(`delete from ${table}`)));
      expect(await causeOf(update)).toMatch(permissionDenied);
      expect(await causeOf(remove)).toMatch(permissionDenied);
    },
  );
});

describe('platform plans', () => {
  it('are readable but not writable from a box', async () => {
    const plans = await asBoxA((transaction) => transaction.select().from(platformPlans));
    expect(plans.length).toBeGreaterThan(0);
    const insert = asBoxA((transaction) =>
      transaction.insert(platformPlans).values({
        code: 'free',
        name: 'Gratis',
        monthlyPriceGs: 0,
        extraLocationMonthlyPriceGs: 0,
      }),
    );
    expect(await causeOf(insert)).toMatch(permissionDenied);
  });
});

describe('AI and feature tables', () => {
  it.each(['ai_settings', 'ai_provider_keys'])('%s is unreachable from a box', async (table) => {
    const read = asBoxA((transaction) => transaction.execute(sql.raw(`select * from ${table}`)));
    expect(await causeOf(read)).toMatch(permissionDenied);
  });

  it('plan features are readable but not writable from a box', async () => {
    const [plan] = await asBoxA((transaction) => transaction.select().from(platformPlans));
    await expect(
      asBoxA((transaction) => transaction.select().from(platformPlanFeatures)),
    ).resolves.toBeDefined();
    const insert = asBoxA((transaction) =>
      transaction
        .insert(platformPlanFeatures)
        .values({ platformPlanId: plan?.id ?? '', feature: 'ai_import', enabled: true }),
    );
    expect(await causeOf(insert)).toMatch(permissionDenied);
  });

  it('a box cannot turn a feature on for itself', async () => {
    const insert = asBoxA((transaction) =>
      transaction
        .insert(boxFeatureOverrides)
        .values({ boxId: boxA.boxId, feature: 'ai_import', enabled: true }),
    );
    expect(await causeOf(insert)).toMatch(permissionDenied);
  });

  it('a box records its AI usage but cannot erase it', async () => {
    await asBoxA((transaction) =>
      transaction.insert(aiUsage).values({
        boxId: boxA.boxId,
        feature: 'ai_import',
        provider: 'anthropic',
        model: 'claude-opus-5-5',
      }),
    );
    const remove = asBoxA((transaction) => transaction.delete(aiUsage));
    const reset = asBoxA((transaction) => transaction.update(aiUsage).set({ inputTokens: 0 }));
    expect(await causeOf(remove)).toMatch(permissionDenied);
    expect(await causeOf(reset)).toMatch(permissionDenied);
  });
});

describe('notification tables', () => {
  it.each([
    'push_subscriptions',
    'telegram_links',
    'telegram_link_codes',
    'notification_preferences',
  ])('%s is unreachable from a box', async (table) => {
    const read = asBoxA((transaction) => transaction.execute(sql.raw(`select * from ${table}`)));
    expect(await causeOf(read)).toMatch(permissionDenied);
  });

  it('a box records events but cannot rewrite them or invent deliveries', async () => {
    const [event] = await asBoxA((transaction) =>
      transaction
        .insert(notifications)
        .values({
          boxId: boxA.boxId,
          kind: 'class_cancelled',
          idempotencyKey: 'class_cancelled:global-test',
          audience: { type: 'members', memberIds: [] },
          params: {},
        })
        .returning(),
    );
    const expand = asBoxA((transaction) =>
      transaction.update(notifications).set({ expandedAt: new Date() }),
    );
    const deliver = asBoxA((transaction) =>
      transaction.insert(notificationDeliveries).values({
        boxId: boxA.boxId,
        notificationId: event?.id ?? '',
        channel: 'whatsapp',
        recipientKey: 'member:x',
        address: '+595981000000',
        message: { title: 't', body: 'b' },
      }),
    );
    const erase = asBoxA((transaction) => transaction.delete(notificationDeliveries));
    expect(await causeOf(expand)).toMatch(permissionDenied);
    expect(await causeOf(deliver)).toMatch(permissionDenied);
    expect(await causeOf(erase)).toMatch(permissionDenied);
  });

  it('the same event cannot be recorded twice', async () => {
    const record = () =>
      asBoxA((transaction) =>
        transaction.insert(notifications).values({
          boxId: boxA.boxId,
          kind: 'workout_published',
          idempotencyKey: 'workout_published:twice',
          audience: { type: 'active_members' },
          params: {},
        }),
      );
    await record();
    expect(await causeOf(record())).toMatch(/duplicate key|unique/);
  });
});

describe('login tables', () => {
  it.each([
    'user_credentials',
    'oauth_accounts',
    'sessions',
    'password_reset_tokens',
    'rate_limit_counters',
  ])('%s is unreachable from a box', async (table) => {
    const read = asBoxA((transaction) => transaction.execute(sql.raw(`select * from ${table}`)));
    expect(await causeOf(read)).toMatch(permissionDenied);
  });
});

describe('row level security coverage', () => {
  it('is enabled on every table except the public platform catalog', async () => {
    const result = await withSystemScope(testDatabase.database, (transaction) =>
      transaction.execute(sql`
        select c.relname as table_name, c.relrowsecurity as rls,
          (select count(*)::int from pg_policies p where p.tablename = c.relname) as policies
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'`),
    );
    const unprotected = rowsOf<{ table_name: string; rls: boolean; policies: number }>(result)
      .filter((row) => !row.rls || row.policies === 0)
      .map((row) => row.table_name);
    expect(unprotected).toEqual(['platform_plans']);
  });
});
