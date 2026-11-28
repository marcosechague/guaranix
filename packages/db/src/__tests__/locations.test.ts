import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../schema';
import { withBoxScope, withSystemScope } from '../scope';
import { seedDemoBox, seedPlatform } from '../seed';
import { createTestDatabase } from '../testing/test-database';

type TestDatabase = Awaited<ReturnType<typeof createTestDatabase>>;
type Transaction = Parameters<Parameters<typeof withSystemScope>[1]>[0];

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
});

afterAll(async () => {
  await testDatabase.close();
});

const asBox = <T>(boxId: string, work: (transaction: Transaction) => Promise<T>) =>
  withBoxScope(testDatabase.database, { boxId }, work);

async function locationsOf(transaction: Transaction, boxId: string) {
  return transaction.select().from(schema.locations).where(eq(schema.locations.boxId, boxId));
}

async function defaultLocationId(transaction: Transaction, boxId: string) {
  const [location] = await transaction
    .select()
    .from(schema.locations)
    .where(and(eq(schema.locations.boxId, boxId), eq(schema.locations.isDefault, true)));
  if (!location) throw new Error('box has no default location');
  return location.id;
}

async function firstProgramId(transaction: Transaction, boxId: string) {
  const [program] = await transaction
    .select()
    .from(schema.programs)
    .where(eq(schema.programs.boxId, boxId))
    .limit(1);
  if (!program) throw new Error('box has no programs');
  return program.id;
}

describe('default location', () => {
  it('is created with every box', async () => {
    const rows = await asBox(boxA.boxId, (transaction) => locationsOf(transaction, boxA.boxId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ isDefault: true, isActive: true, name: 'Sede principal' });
  });

  it('holds every class and schedule the box already had', async () => {
    const orphans = await withSystemScope(testDatabase.database, async (transaction) => {
      const classes = await transaction.select().from(schema.classes);
      const schedules = await transaction.select().from(schema.classSchedules);
      return [...classes, ...schedules].filter((row) => !row.locationId);
    });
    expect(orphans).toEqual([]);
  });

  it('cannot be doubled', async () => {
    await expect(
      asBox(boxA.boxId, (transaction) =>
        transaction
          .insert(schema.locations)
          .values({ boxId: boxA.boxId, name: 'Otra principal', isDefault: true }),
      ),
    ).rejects.toThrow();
  });

  it('cannot be deactivated', async () => {
    await expect(
      asBox(boxA.boxId, (transaction) =>
        transaction
          .update(schema.locations)
          .set({ isActive: false })
          .where(eq(schema.locations.boxId, boxA.boxId)),
      ),
    ).rejects.toThrow();
  });
});

describe('location of new schedules and classes', () => {
  it("falls back to the box's default when none is given", async () => {
    const [created, expected] = await asBox(boxA.boxId, async (transaction) => {
      const [schedule] = await transaction
        .insert(schema.classSchedules)
        .values({
          boxId: boxA.boxId,
          programId: await firstProgramId(transaction, boxA.boxId),
          weekday: 1,
          startTime: '05:00',
          durationMinutes: 60,
          capacity: 10,
          validFrom: '2026-12-01',
        })
        .returning();
      return [schedule, await defaultLocationId(transaction, boxA.boxId)] as const;
    });
    expect(created?.locationId).toBe(expected);
  });

  it("takes the schedule's location for a class generated from it", async () => {
    const { schedule, generated } = await asBox(boxA.boxId, async (transaction) => {
      const [second] = await transaction
        .insert(schema.locations)
        .values({ boxId: boxA.boxId, name: 'Sede Villa Morra' })
        .returning();
      const [schedule] = await transaction
        .insert(schema.classSchedules)
        .values({
          boxId: boxA.boxId,
          programId: await firstProgramId(transaction, boxA.boxId),
          locationId: second?.id,
          weekday: 2,
          startTime: '05:00',
          durationMinutes: 60,
          capacity: 10,
          validFrom: '2026-12-01',
        })
        .returning();
      const [generated] = await transaction
        .insert(schema.classes)
        .values({
          boxId: boxA.boxId,
          programId: schedule?.programId ?? '',
          scheduleId: schedule?.id,
          startsAt: new Date('2026-12-01T08:00:00Z'),
          endsAt: new Date('2026-12-01T09:00:00Z'),
          capacity: 10,
        })
        .returning();
      return { schedule, generated };
    });
    expect(generated?.locationId).toBe(schedule?.locationId);
  });

  it('rejects a location of another box, even without RLS', async () => {
    await expect(
      withSystemScope(testDatabase.database, async (transaction) => {
        await transaction.insert(schema.classes).values({
          boxId: boxA.boxId,
          programId: await firstProgramId(transaction, boxA.boxId),
          locationId: await defaultLocationId(transaction, boxB.boxId),
          startsAt: new Date('2026-12-02T08:00:00Z'),
          endsAt: new Date('2026-12-02T09:00:00Z'),
          capacity: 10,
        });
      }),
    ).rejects.toThrow();
  });
});
