import type { classes } from '@guaranix/db/schema';
import { boxUsers, programs, workouts } from '@guaranix/db/schema';
import {
  addDays,
  calendarDateIn,
  dateOfInstant,
  formatDayMonth,
  formatTimeIn,
  type NotificationParams,
  weekdayLong,
} from '@guaranix/shared';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { currentBox } from '../box-calendar';
import { isStaff, MANAGER_ROLES, type ServiceContext } from '../context';
import { recordNotification } from './record';

type ClassRow = typeof classes.$inferSelect;
type BookingLike = { id: string; memberId: string };

/** `viernes 28 de noviembre`, in the box's time zone. */
export function dayLabel(date: string): string {
  return `${weekdayLong(date).toLowerCase()} ${formatDayMonth(date)}`;
}

async function programName(context: ServiceContext, programId: string): Promise<string> {
  const [program] = await context.transaction
    .select({ name: programs.name })
    .from(programs)
    .where(eq(programs.id, programId));
  return program?.name ?? '';
}

async function classParams(
  context: ServiceContext,
  classRow: ClassRow,
): Promise<NotificationParams> {
  const box = await currentBox(context);
  return {
    program: await programName(context, classRow.programId),
    day: dayLabel(dateOfInstant(box.timezone, classRow.startsAt)),
    time: formatTimeIn(box.timezone, classRow.startsAt),
    tag: `class-${classRow.id}`,
  };
}

/** Only when staff booked for someone (phone call, walk-in): a member booking sees it on screen. */
export async function notifyBookingConfirmed(
  context: ServiceContext,
  booking: BookingLike & { status: string },
  classRow: ClassRow,
): Promise<void> {
  if (!isStaff(context.auth.role) || booking.status !== 'booked') return;
  await recordNotification(context, {
    kind: 'booking_confirmed',
    key: `${booking.id}:${context.now.getTime()}`,
    audience: { type: 'members', memberIds: [booking.memberId] },
    params: await classParams(context, classRow),
  });
}

/** Everyone who just got a spot from the waitlist. */
export async function notifyWaitlistPromoted(
  context: ServiceContext,
  promoted: BookingLike[],
  classRow: ClassRow,
): Promise<void> {
  if (promoted.length === 0) return;
  const params = await classParams(context, classRow);
  for (const booking of promoted) {
    await recordNotification(context, {
      kind: 'waitlist_promoted',
      key: `${booking.id}:${context.now.getTime()}`,
      audience: { type: 'members', memberIds: [booking.memberId] },
      params,
    });
  }
}

/**
 * Members who had a spot or were waiting, plus an internal notice for the
 * class's coach and the managers (but not whoever cancelled it).
 */
export async function notifyClassCancelled(
  context: ServiceContext,
  classRow: ClassRow,
  affected: BookingLike[],
  reason: string | null,
): Promise<void> {
  const params = await classParams(context, classRow);
  await recordNotification(context, {
    kind: 'class_cancelled',
    key: classRow.id,
    audience: { type: 'members', memberIds: affected.map((booking) => booking.memberId) },
    params: { ...params, reason },
  });
  const staff = await context.transaction
    .select({ userId: boxUsers.userId, role: boxUsers.role })
    .from(boxUsers)
    .where(
      and(
        eq(boxUsers.isActive, true),
        ne(boxUsers.userId, context.auth.userId),
        inArray(boxUsers.role, [...MANAGER_ROLES, 'coach']),
      ),
    );
  const userIds = staff
    .filter(
      (row) =>
        row.role !== 'coach' ||
        (classRow.coachUserId !== null && row.userId === classRow.coachUserId),
    )
    .map((row) => row.userId);
  await recordNotification(context, {
    kind: 'staff_class_cancelled',
    key: classRow.id,
    audience: { type: 'users', userIds },
    params: { ...params, count: affected.length },
  });
}

/**
 * The first time a WOD for today or tomorrow is published; unpublishing and
 * publishing again stays quiet. WODs loaded further ahead are announced the
 * evening before by the workout announcement job, so a week loaded on Sunday
 * doesn't send seven notifications at once.
 */
export async function notifyWorkoutPublished(
  context: ServiceContext,
  workoutId: string,
): Promise<void> {
  const [workout] = await context.transaction
    .select({ programId: workouts.programId, date: workouts.workoutDate, title: workouts.title })
    .from(workouts)
    .where(eq(workouts.id, workoutId));
  if (!workout) return;
  const today = calendarDateIn((await currentBox(context)).timezone, context.now);
  if (workout.date < today || workout.date > addDays(today, 1)) return;
  await announceWorkout(context, workoutId, workout);
}

/** Records the WOD announcement; its key makes a second call for the same WOD a no-op. */
export async function announceWorkout(
  context: ServiceContext,
  workoutId: string,
  workout: { programId: string; date: string; title: string | null },
): Promise<void> {
  await recordNotification(context, {
    kind: 'workout_published',
    key: workoutId,
    audience: { type: 'active_members' },
    params: {
      program: await programName(context, workout.programId),
      day: dayLabel(workout.date),
      title: workout.title,
      tag: `workout-${workout.date}`,
    },
  });
}
