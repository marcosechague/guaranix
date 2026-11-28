import { and, asc, count, eq, gte, inArray, lt } from 'drizzle-orm';
import { bookings, classes, members, programs } from '@guaranix/db/schema';
import { addDays, daysBetween, zonedInstant } from '@guaranix/shared';
import { recordAudit } from './audit';
import { currentBox } from './box-calendar';
import { SPOT_STATUSES, lockClass, promoteFromWaitlist, takenSpots } from './bookings';
import { notifyClassCancelled, notifyWaitlistPromoted } from './notifications/events';
import {
  CLASS_STAFF_ROLES,
  MANAGER_ROLES,
  assertRole,
  isStaff,
  type ServiceContext,
} from './context';
import { refundCredit } from './credits';
import { notFound, unprocessable } from './errors';
import { getOwnMember } from './members';
import { definedFields } from './objects';
import { assertCoach } from './schedules';

const MAX_LISTING_DAYS = 31;

/**
 * Classes between two box-local dates (inclusive), with how many spots are
 * taken and, for members, their own booking, so the app can show a "Reservá"
 * or "Estás en lista de espera" button without another request.
 */
export async function listClasses(
  context: ServiceContext,
  range: { from: string; to: string; locationId?: string | undefined },
) {
  const days = daysBetween(range.from, range.to) + 1;
  if (days < 1 || days > MAX_LISTING_DAYS) throw unprocessable('date_range_invalid');
  const box = await currentBox(context);
  const rows = await context.transaction
    .select({ class: classes, programName: programs.name, programColor: programs.color })
    .from(classes)
    .innerJoin(programs, eq(programs.id, classes.programId))
    .where(
      and(
        gte(classes.startsAt, zonedInstant(range.from, '00:00', box.timezone)),
        lt(classes.startsAt, zonedInstant(addDays(range.to, 1), '00:00', box.timezone)),
        range.locationId ? eq(classes.locationId, range.locationId) : undefined,
      ),
    )
    .orderBy(asc(classes.startsAt));
  if (rows.length === 0) return [];

  const classIds = rows.map((row) => row.class.id);
  const counts = await context.transaction
    .select({ classId: bookings.classId, status: bookings.status, total: count() })
    .from(bookings)
    .where(inArray(bookings.classId, classIds))
    .groupBy(bookings.classId, bookings.status);
  const ownBookings = isStaff(context.auth.role)
    ? []
    : await context.transaction
        .select()
        .from(bookings)
        .where(
          and(
            inArray(bookings.classId, classIds),
            eq(bookings.memberId, (await getOwnMember(context)).id),
          ),
        );

  return rows.map(({ class: classRow, programName, programColor }) => {
    const totalFor = (statuses: readonly string[]) =>
      counts
        .filter((row) => row.classId === classRow.id && statuses.includes(row.status))
        .reduce((sum, row) => sum + row.total, 0);
    const taken = totalFor(SPOT_STATUSES);
    const own = ownBookings.find((booking) => booking.classId === classRow.id);
    return {
      ...classRow,
      programName,
      programColor,
      takenSpots: taken,
      spotsLeft: Math.max(classRow.capacity - taken, 0),
      waitlistCount: totalFor(['waitlisted']),
      ownBooking: own
        ? { id: own.id, status: own.status, waitlistPosition: own.waitlistPosition }
        : null,
    };
  });
}

/** Who is booked or waiting, for the coach's attendance screen. */
export async function getClassRoster(context: ServiceContext, classId: string) {
  assertRole(context.auth.role, CLASS_STAFF_ROLES);
  const [classRow] = await context.transaction
    .select()
    .from(classes)
    .where(eq(classes.id, classId));
  if (!classRow) throw notFound('class');
  const roster = await context.transaction
    .select({
      bookingId: bookings.id,
      memberId: members.id,
      firstName: members.firstName,
      lastName: members.lastName,
      status: bookings.status,
      waitlistPosition: bookings.waitlistPosition,
      checkedInAt: bookings.checkedInAt,
    })
    .from(bookings)
    .innerJoin(members, eq(members.id, bookings.memberId))
    .where(eq(bookings.classId, classId))
    .orderBy(asc(bookings.waitlistPosition), asc(members.lastName));
  return { class: classRow, roster };
}

/** Cancels a class (holiday, coach sick): every booking is cancelled and credits go back. */
export async function cancelClass(context: ServiceContext, classId: string, reason: string | null) {
  assertRole(context.auth.role, MANAGER_ROLES);
  const classRow = await lockClass(context, classId);
  if (classRow.status === 'cancelled') return { class: classRow, cancelledBookings: 0 };
  const affected = await context.transaction
    .select()
    .from(bookings)
    .where(and(eq(bookings.classId, classId), inArray(bookings.status, ['booked', 'waitlisted'])));
  if (affected.length > 0) {
    await context.transaction
      .update(bookings)
      .set({ status: 'cancelled', waitlistPosition: null, cancelledAt: context.now })
      .where(
        inArray(
          bookings.id,
          affected.map((booking) => booking.id),
        ),
      );
  }
  for (const booking of affected) {
    // Only booked spots had spent a credit; waitlisted ones never did.
    if (booking.status === 'booked' && booking.memberPlanId) {
      await refundCredit(context, booking.memberPlanId);
    }
  }
  const [cancelled] = await context.transaction
    .update(classes)
    .set({ status: 'cancelled', cancellationReason: reason })
    .where(eq(classes.id, classId))
    .returning();
  if (!cancelled) throw notFound('class');
  await notifyClassCancelled(context, classRow, affected, reason);
  await recordAudit(context, {
    action: 'class.cancelled',
    entityType: 'class',
    entityId: classId,
    changes: { reason, cancelledBookings: affected.length },
  });
  return { class: cancelled, cancelledBookings: affected.length };
}

/** Changes capacity or coach of one class. More spots are filled from the waitlist. */
export async function updateClass(
  context: ServiceContext,
  classId: string,
  input: { capacity?: number | undefined; coachUserId?: string | null | undefined },
) {
  assertRole(context.auth.role, MANAGER_ROLES);
  const classRow = await lockClass(context, classId);
  if (input.capacity !== undefined && input.capacity < (await takenSpots(context, classId))) {
    throw unprocessable('capacity_below_bookings');
  }
  if (input.coachUserId !== undefined) await assertCoach(context, input.coachUserId);
  const fields = definedFields(input);
  if (Object.keys(fields).length === 0) return { class: classRow, promoted: [] };
  const [updated] = await context.transaction
    .update(classes)
    .set(fields)
    .where(eq(classes.id, classId))
    .returning();
  if (!updated) throw notFound('class');
  const promoted = await promoteFromWaitlist(context, updated, await currentBox(context));
  await notifyWaitlistPromoted(context, promoted, updated);
  return { class: updated, promoted };
}
