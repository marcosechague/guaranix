import { withSystemScope } from '@guaranix/db';
import { boxes, classSchedules, classes } from '@guaranix/db/schema';
import { and, count, eq, gte } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateUpcomingClasses } from '../jobs/upcoming-classes';
import { UPCOMING_CLASS_DAYS } from '../services/class-generation';
import { createHarness, type Harness } from './harness';

let harness: Harness;
const DAY = 24 * 60 * 60 * 1000;
const now = new Date();

beforeAll(async () => {
  harness = await createHarness();
});

afterAll(async () => {
  await harness.close();
});

const system = <T>(work: Parameters<typeof withSystemScope<T>>[1]) =>
  withSystemScope(harness.database, work);

async function classCount(boxId: string) {
  const [row] = await system((transaction) =>
    transaction.select({ total: count() }).from(classes).where(eq(classes.boxId, boxId)),
  );
  return row?.total ?? 0;
}

async function scheduleCount(boxId: string) {
  const [row] = await system((transaction) =>
    transaction
      .select({ total: count() })
      .from(classSchedules)
      .where(eq(classSchedules.boxId, boxId)),
  );
  return row?.total ?? 0;
}

const setStatus = (boxId: string, status: 'active' | 'suspended') =>
  system((transaction) => transaction.update(boxes).set({ status }).where(eq(boxes.id, boxId)));

describe('upcoming classes cron', () => {
  it('skips suspended boxes and fills two weeks for the rest', async () => {
    const { boxA, boxB } = harness;
    await setStatus(boxB.boxId, 'suspended');
    const boxBBefore = await classCount(boxB.boxId);

    const result = await generateUpcomingClasses(harness.database, now);

    expect(result.failedBoxIds).toEqual([]);
    // Every weekly schedule appears twice in 14 days.
    expect(await classCount(boxA.boxId)).toBe((await scheduleCount(boxA.boxId)) * 2);
    expect(await classCount(boxB.boxId)).toBe(boxBBefore);
  });

  it('is idempotent', async () => {
    const before = await classCount(harness.boxA.boxId);
    const result = await generateUpcomingClasses(harness.database, now);
    expect(result.created).toBe(0);
    expect(await classCount(harness.boxA.boxId)).toBe(before);
  });

  it('catches a reactivated box up on the next run', async () => {
    const { boxB } = harness;
    await setStatus(boxB.boxId, 'active');
    await generateUpcomingClasses(harness.database, now);
    expect(await classCount(boxB.boxId)).toBe((await scheduleCount(boxB.boxId)) * 2);
  });

  it('uses the current capacity for new days and leaves existing classes alone', async () => {
    const { boxA } = harness;
    const [schedule] = await system((transaction) =>
      transaction
        .update(classSchedules)
        .set({ capacity: 7 })
        .where(eq(classSchedules.boxId, boxA.boxId))
        .returning(),
    );
    if (!schedule) throw new Error('The demo box has schedules');
    const weekLater = new Date(now.getTime() + 7 * DAY);
    const result = await generateUpcomingClasses(harness.database, weekLater);
    expect(result.created).toBeGreaterThan(0);

    const rows = await system((transaction) =>
      transaction
        .select({ startsAt: classes.startsAt, capacity: classes.capacity })
        .from(classes)
        .where(and(eq(classes.scheduleId, schedule.id), gte(classes.startsAt, now))),
    );
    const horizon = now.getTime() + (UPCOMING_CLASS_DAYS - 1) * DAY;
    const added = rows.filter((row) => row.startsAt.getTime() > horizon);
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((row) => row.capacity === 7)).toBe(true);
    expect(rows.some((row) => row.capacity !== 7)).toBe(true);
  });
});
