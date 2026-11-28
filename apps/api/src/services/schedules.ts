import { and, asc, eq } from 'drizzle-orm';
import type { z } from 'zod';
import { boxUsers, classSchedules } from '@guaranix/db/schema';
import type { classScheduleSchema } from '@guaranix/shared/schemas';
import { recordAudit } from './audit';
import { currentBox } from './box-calendar';
import { MANAGER_ROLES, assertRole, type ServiceContext } from './context';
import { notFound, unprocessable } from './errors';
import { createClassesFromSchedules } from './class-generation';
import { resolveLocationId } from './locations';
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
  const locationId = await resolveLocationId(context, input.locationId);
  const [schedule] = await context.transaction
    .insert(classSchedules)
    .values({ ...input, locationId, boxId: context.auth.boxId })
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

export { MAX_GENERATION_DAYS } from './class-generation';

/** Creates the classes of every schedule in the range; safe to run again. */
export async function generateClasses(
  context: ServiceContext,
  range: { from: string; days: number },
): Promise<{ created: number }> {
  assertRole(context.auth.role, MANAGER_ROLES);
  const box = await currentBox(context);
  return createClassesFromSchedules(
    context.transaction,
    { id: context.auth.boxId, timezone: box.timezone },
    range,
  );
}
