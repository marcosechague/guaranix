import { and, asc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import type { z } from 'zod';
import { boxUsers, classSchedules, classes } from '@guaranix/db/schema';
import { addDays, weekdayOf, zonedInstant } from '@guaranix/shared';
import type { classScheduleSchema } from '@guaranix/shared/schemas';
import { recordAudit } from './audit';
import { currentBox } from './box-calendar';
import { MANAGER_ROLES, assertRole, type ServiceContext } from './context';
import { notFound, unprocessable } from './errors';
import { getProgram } from './programs';

export type ScheduleInput = z.output<typeof classScheduleSchema>;
export type ScheduleRow = typeof classSchedules.$inferSelect;

/** Coaches must be active staff of this box with a role that can run a class. */
export async function assertCoach(context: ServiceContext, coachUserId: string | null) {
  if (coachUserId === null) return;
  const [staff] = await context.transaction
    .select()
    .from(boxUsers)
    .where(and(eq(boxUsers.userId, coachUserId), eq(boxUsers.isActive, true)));
  if (!staff || staff.role === 'member') throw unprocessable('coach_not_found');
}

export async function listSchedules(context: ServiceContext): Promise<ScheduleRow[]> {
  return context.transaction
    .select()
    .from(classSchedules)
    .orderBy(asc(classSchedules.weekday), asc(classSchedules.startTime));
}

export async function createSchedule(
  context: ServiceContext,
  input: ScheduleInput,
): Promise<ScheduleRow> {
  assertRole(context.auth.role, MANAGER_ROLES);
  await getProgram(context, input.programId);
  await assertCoach(context, input.coachUserId);
  const [schedule] = await context.transaction
    .insert(classSchedules)
    .values({ ...input, boxId: context.auth.boxId })
    .returning();
  if (!schedule) throw new Error('Schedule insert returned no row');
  await recordAudit(context, {
    action: 'schedule.created',
    entityType: 'class_schedule',
    entityId: schedule.id,
  });
  return schedule;
}

/**
 * Stops a recurring slot from a date on. Classes already generated stay, so
 * existing bookings are not lost; cancel those explicitly if needed.
 */
export async function endSchedule(
  context: ServiceContext,
  scheduleId: string,
  lastDate: string,
): Promise<ScheduleRow> {
  assertRole(context.auth.role, MANAGER_ROLES);
  const [before] = await context.transaction
    .select()
    .from(classSchedules)
    .where(eq(classSchedules.id, scheduleId));
  if (!before) throw notFound('schedule');
  if (lastDate < before.validFrom) throw unprocessable('schedule_end_before_start');
  const [schedule] = await context.transaction
    .update(classSchedules)
    .set({ validUntil: lastDate })
    .where(eq(classSchedules.id, scheduleId))
    .returning();
  if (!schedule) throw notFound('schedule');
  await recordAudit(context, {
    action: 'schedule.ended',
    entityType: 'class_schedule',
    entityId: schedule.id,
    changes: { validUntil: { from: before.validUntil, to: lastDate } },
  });
  return schedule;
}

export const MAX_GENERATION_DAYS = 62;

/**
 * Creates the concrete classes of every schedule between `from` and
 * `from + days - 1`. Safe to run again: existing classes are skipped.
 */
export async function generateClasses(
  context: ServiceContext,
  range: { from: string; days: number },
): Promise<{ created: number }> {
  assertRole(context.auth.role, MANAGER_ROLES);
  if (range.days < 1 || range.days > MAX_GENERATION_DAYS) {
    throw unprocessable('generation_range_invalid');
  }
  const until = addDays(range.from, range.days - 1);
  const box = await currentBox(context);
  const schedules = await context.transaction
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
        boxId: context.auth.boxId,
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
  const created = await context.transaction
    .insert(classes)
    .values(rows)
    .onConflictDoNothing({ target: [classes.scheduleId, classes.startsAt] })
    .returning({ id: classes.id });
  return { created: created.length };
}
