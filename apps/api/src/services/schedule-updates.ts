import { and, eq, gt } from 'drizzle-orm';
import { classSchedules, classes } from '@guaranix/db/schema';
import type { UpdateScheduleInput } from '@guaranix/shared/schemas';
import { diff, recordAudit } from './audit';
import { takenSpots } from './bookings';
import { updateClass } from './classes';
import { MANAGER_ROLES, assertRole, type ServiceContext } from './context';
import { notFound } from './errors';
import { definedFields } from './objects';
import { assertCoach } from './schedules';

/**
 * Changes a weekly slot and the classes it already generated that haven't started.
 * A class with more bookings than the new capacity keeps those people: its
 * capacity drops only as far as its bookings, so nobody loses a confirmed spot.
 */
export async function updateSchedule(
  context: ServiceContext,
  scheduleId: string,
  input: UpdateScheduleInput,
) {
  assertRole(context.auth.role, MANAGER_ROLES);
  const [before] = await context.transaction
    .select()
    .from(classSchedules)
    .where(eq(classSchedules.id, scheduleId));
  if (!before) throw notFound('schedule');
  if (input.coachUserId !== undefined) await assertCoach(context, input.coachUserId);
  const fields = definedFields(input);
  if (Object.keys(fields).length === 0) return { schedule: before, updatedClasses: 0 };

  const [schedule] = await context.transaction
    .update(classSchedules)
    .set(fields)
    .where(eq(classSchedules.id, scheduleId))
    .returning();
  if (!schedule) throw notFound('schedule');

  const upcoming = await context.transaction
    .select({ id: classes.id })
    .from(classes)
    .where(
      and(
        eq(classes.scheduleId, scheduleId),
        eq(classes.status, 'scheduled'),
        gt(classes.startsAt, context.now),
      ),
    );
  for (const classRow of upcoming) {
    const capacity =
      input.capacity === undefined
        ? undefined
        : Math.max(input.capacity, await takenSpots(context, classRow.id));
    await updateClass(context, classRow.id, { capacity, coachUserId: input.coachUserId });
  }

  await recordAudit(context, {
    action: 'schedule.updated',
    entityType: 'class_schedule',
    entityId: schedule.id,
    changes: diff(before, fields),
  });
  return { schedule, updatedClasses: upcoming.length };
}
