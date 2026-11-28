import type { ScopedTransaction } from '@guaranix/db';
import { classSchedules, classes } from '@guaranix/db/schema';
import { addDays, weekdayOf, zonedInstant } from '@guaranix/shared';
import { and, gte, isNull, lte, or } from 'drizzle-orm';
import { unprocessable } from './errors';

export const MAX_GENERATION_DAYS = 62;

/** How far ahead members can see and book classes: kept by the daily cron, filled at sign-up. */
export const UPCOMING_CLASS_DAYS = 14;

/**
 * Creates the concrete classes of every schedule between `from` and
 * `from + days - 1`. Safe to run again: existing classes are skipped, so a
 * class someone edited or cancelled stays as it is. The transaction must
 * already be scoped to `box.id` (RLS), which is what limits the schedules read.
 */
export async function createClassesFromSchedules(
  transaction: ScopedTransaction,
  box: { id: string; timezone: string },
  range: { from: string; days: number },
): Promise<{ created: number }> {
  if (range.days < 1 || range.days > MAX_GENERATION_DAYS) {
    throw unprocessable('generation_range_invalid');
  }
  const until = addDays(range.from, range.days - 1);
  const schedules = await transaction
    .select()
    .from(classSchedules)
    .where(
      and(
        lte(classSchedules.validFrom, until),
        or(isNull(classSchedules.validUntil), gte(classSchedules.validUntil, range.from)),
      ),
    );

  const rows = [];
  for (let offset = 0; offset < range.days; offset += 1) {
    const date = addDays(range.from, offset);
    const weekday = weekdayOf(date);
    for (const schedule of schedules) {
      const inRange =
        schedule.weekday === weekday &&
        schedule.validFrom <= date &&
        (schedule.validUntil === null || date <= schedule.validUntil);
      if (!inRange) continue;
      const startsAt = zonedInstant(date, schedule.startTime, box.timezone);
      rows.push({
        boxId: box.id,
        programId: schedule.programId,
        scheduleId: schedule.id,
        coachUserId: schedule.coachUserId,
        startsAt,
        endsAt: new Date(startsAt.getTime() + schedule.durationMinutes * 60_000),
        capacity: schedule.capacity,
      });
    }
  }
  if (rows.length === 0) return { created: 0 };
  const created = await transaction
    .insert(classes)
    .values(rows)
    .onConflictDoNothing({ target: [classes.scheduleId, classes.startsAt] })
    .returning({ id: classes.id });
  return { created: created.length };
}
