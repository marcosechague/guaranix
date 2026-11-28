import { type SchemaDatabase, withBoxScope, withSystemScope } from '@guaranix/db';
import { boxes } from '@guaranix/db/schema';
import { calendarDateIn } from '@guaranix/shared';
import { inArray } from 'drizzle-orm';
import { createClassesFromSchedules, UPCOMING_CLASS_DAYS } from '../services/class-generation';

/** Suspended and cancelled boxes get no new classes; reactivating one catches up on the next run. */
const GENERATING_STATUSES = ['trial', 'active'] as const;

export interface UpcomingClassesResult {
  boxes: number;
  created: number;
  failedBoxIds: string[];
}

/**
 * Keeps every working box's classes generated `UPCOMING_CLASS_DAYS` ahead of
 * its own today. Idempotent: classes that already exist (edited, cancelled or
 * with bookings) are left alone, and schedule edits already reach existing
 * classes through `updateSchedule`. Each box runs in its own scoped
 * transaction, so one broken box never stops the rest.
 */
export async function generateUpcomingClasses(
  database: SchemaDatabase,
  now: Date,
): Promise<UpcomingClassesResult> {
  // Unscoped only to list which boxes to visit; the work itself runs under RLS.
  const targets = await withSystemScope(database, (transaction) =>
    transaction
      .select({ id: boxes.id, timezone: boxes.timezone })
      .from(boxes)
      .where(inArray(boxes.status, [...GENERATING_STATUSES])),
  );
  const result: UpcomingClassesResult = { boxes: targets.length, created: 0, failedBoxIds: [] };
  for (const box of targets) {
    try {
      const { created } = await withBoxScope(database, { boxId: box.id }, (transaction) =>
        createClassesFromSchedules(transaction, box, {
          from: calendarDateIn(box.timezone, now),
          days: UPCOMING_CLASS_DAYS,
        }),
      );
      result.created += created;
    } catch (error) {
      result.failedBoxIds.push(box.id);
      console.error('Class generation failed', {
        boxId: box.id,
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
  }
  return result;
}
