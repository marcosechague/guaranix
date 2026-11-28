import { and, asc, count, eq, gte, inArray, max } from 'drizzle-orm';
import { bookings, classes, members } from '@guaranix/db/schema';
import type { BookingStatus } from '@guaranix/shared/domain';
import { currentBox } from './box-calendar';
import { findPlanForClass, type BookingPolicy } from './booking-eligibility';
import { isStaff, type ServiceContext } from './context';
import { consumeCredit, refundCredit } from './credits';
import { conflict, notFound, unprocessable, ServiceError } from './errors';
import { getOwnMember } from './members';
import { notifyBookingConfirmed, notifyWaitlistPromoted } from './notifications/events';

export type BookingRow = typeof bookings.$inferSelect;
type ClassRow = typeof classes.$inferSelect;
type Box = Awaited<ReturnType<typeof currentBox>>;

/** Statuses that hold a spot in the class. */
export const SPOT_STATUSES = ['booked', 'attended', 'no_show'] as const satisfies BookingStatus[];
const ACTIVE_STATUSES = [...SPOT_STATUSES, 'waitlisted'] as const satisfies BookingStatus[];

const MINUTE_MS = 60_000;

/** Locks the class row so concurrent bookings can't both take the last spot. */
export async function lockClass(context: ServiceContext, classId: string): Promise<ClassRow> {
  const [classRow] = await context.transaction
    .select()
    .from(classes)
    .where(eq(classes.id, classId))
    .for('update');
  if (!classRow) throw notFound('class');
  return classRow;
}

export async function takenSpots(context: ServiceContext, classId: string): Promise<number> {
  const [row] = await context.transaction
    .select({ taken: count() })
    .from(bookings)
    .where(and(eq(bookings.classId, classId), inArray(bookings.status, SPOT_STATUSES)));
  return row?.taken ?? 0;
}

function assertBookable(context: ServiceContext, classRow: ClassRow, box: Box) {
  if (classRow.status === 'cancelled') throw unprocessable('class_cancelled');
  const startsAt = classRow.startsAt.getTime();
  const now = context.now.getTime();
  if (now >= startsAt) throw unprocessable('class_started');
  // Staff can add someone outside the window (a walk-in, a phone call).
  if (isStaff(context.auth.role)) return;
  if (now < startsAt - box.bookingOpensHoursBefore * 60 * MINUTE_MS) {
    throw unprocessable('booking_not_open');
  }
  if (now > startsAt - box.bookingClosesMinutesBefore * MINUTE_MS) {
    throw unprocessable('booking_closed');
  }
}

/** Members book for themselves; staff must say who. */
async function resolveMemberId(context: ServiceContext, memberId: string | undefined) {
  if (!isStaff(context.auth.role)) {
    const own = await getOwnMember(context);
    if (memberId !== undefined && memberId !== own.id) throw notFound('member');
    if (own.status !== 'active') throw unprocessable('member_inactive');
    return own.id;
  }
  if (memberId === undefined) throw unprocessable('member_required');
  const [member] = await context.transaction.select().from(members).where(eq(members.id, memberId));
  if (!member) throw notFound('member');
  if (member.status !== 'active') throw unprocessable('member_inactive');
  return member.id;
}

function policyOf(box: Box): BookingPolicy {
  return {
    timezone: box.timezone,
    lateCancelConsumesCredit: box.lateCancelConsumesCredit,
    noShowConsumesCredit: box.noShowConsumesCredit,
  };
}

async function nextWaitlistPosition(context: ServiceContext, classId: string): Promise<number> {
  const [row] = await context.transaction
    .select({ last: max(bookings.waitlistPosition) })
    .from(bookings)
    .where(eq(bookings.classId, classId));
  return (row?.last ?? 0) + 1;
}

/**
 * Books a class in one call (the "2 taps" flow): picks the plan that pays for
 * it, takes a credit if it's a pack, and joins the waitlist when the class is
 * full. Waitlisted bookings don't spend a credit until they get a spot.
 */
export async function bookClass(
  context: ServiceContext,
  input: { classId: string; memberId?: string | undefined },
): Promise<BookingRow> {
  const box = await currentBox(context);
  const memberId = await resolveMemberId(context, input.memberId);
  const classRow = await lockClass(context, input.classId);
  assertBookable(context, classRow, box);

  const [existing] = await context.transaction
    .select()
    .from(bookings)
    .where(and(eq(bookings.classId, classRow.id), eq(bookings.memberId, memberId)));
  if (existing && (ACTIVE_STATUSES as readonly BookingStatus[]).includes(existing.status)) {
    throw conflict('already_booked');
  }

  const plan = await findPlanForClass(context, memberId, classRow, policyOf(box));
  const hasSpot = (await takenSpots(context, classRow.id)) < classRow.capacity;
  if (hasSpot) await consumeCredit(context, plan.id);
  const values = {
    memberPlanId: plan.id,
    status: hasSpot ? ('booked' as const) : ('waitlisted' as const),
    waitlistPosition: hasSpot ? null : await nextWaitlistPosition(context, classRow.id),
    cancelledAt: null,
    checkedInAt: null,
  };

  // One row per member and class: booking again after cancelling reuses it.
  const [booking] = existing
    ? await context.transaction
        .update(bookings)
        .set(values)
        .where(eq(bookings.id, existing.id))
        .returning()
    : await context.transaction
        .insert(bookings)
        .values({ ...values, boxId: context.auth.boxId, classId: classRow.id, memberId })
        .returning();
  if (!booking) throw new Error('Booking was not saved');
  await notifyBookingConfirmed(context, booking, classRow);
  return booking;
}

async function getBookingForActor(context: ServiceContext, bookingId: string) {
  const [booking] = await context.transaction
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .for('update');
  if (!booking) throw notFound('booking');
  if (!isStaff(context.auth.role)) {
    const own = await getOwnMember(context);
    if (booking.memberId !== own.id) throw notFound('booking');
  }
  return booking;
}

/**
 * Cancels a booking. Inside the box's late-cancel window it becomes
 * `late_cancelled` and, if the box says so, the credit is kept as a penalty.
 * Staff can forgive the penalty. A freed spot goes to the waitlist.
 */
export async function cancelBooking(
  context: ServiceContext,
  bookingId: string,
  options: { forgiveLateCancel?: boolean | undefined } = {},
): Promise<{ booking: BookingRow; promoted: BookingRow[] }> {
  const booking = await getBookingForActor(context, bookingId);
  if (booking.status === 'waitlisted') {
    const [cancelled] = await context.transaction
      .update(bookings)
      .set({ status: 'cancelled', waitlistPosition: null, cancelledAt: context.now })
      .where(eq(bookings.id, booking.id))
      .returning();
    if (!cancelled) throw notFound('booking');
    return { booking: cancelled, promoted: [] };
  }
  if (booking.status !== 'booked') throw unprocessable('booking_not_cancellable');

  const box = await currentBox(context);
  const classRow = await lockClass(context, booking.classId);
  if (context.now >= classRow.startsAt) throw unprocessable('class_started');
  const lateFrom = classRow.startsAt.getTime() - box.lateCancelMinutesBefore * MINUTE_MS;
  const forgiven = options.forgiveLateCancel === true && isStaff(context.auth.role);
  const late = context.now.getTime() > lateFrom && !forgiven;

  const [cancelled] = await context.transaction
    .update(bookings)
    .set({ status: late ? 'late_cancelled' : 'cancelled', cancelledAt: context.now })
    .where(eq(bookings.id, booking.id))
    .returning();
  if (!cancelled) throw notFound('booking');
  if (booking.memberPlanId && !(late && box.lateCancelConsumesCredit)) {
    await refundCredit(context, booking.memberPlanId);
  }
  const promoted = box.waitlistAutoPromote ? await promoteFromWaitlist(context, classRow, box) : [];
  await notifyWaitlistPromoted(context, promoted, classRow);
  return { booking: cancelled, promoted };
}

/**
 * Fills free spots from the waitlist in order. Someone whose plan no longer
 * covers the class (expired, out of credits) is skipped and keeps waiting.
 * Returns who got in, so they can be notified.
 */
export async function promoteFromWaitlist(
  context: ServiceContext,
  classRow: ClassRow,
  box: Box,
): Promise<BookingRow[]> {
  if (classRow.status === 'cancelled' || context.now >= classRow.startsAt) return [];
  let free = classRow.capacity - (await takenSpots(context, classRow.id));
  if (free <= 0) return [];
  const waiting = await context.transaction
    .select()
    .from(bookings)
    .where(and(eq(bookings.classId, classRow.id), eq(bookings.status, 'waitlisted')))
    .orderBy(asc(bookings.waitlistPosition));

  const promoted: BookingRow[] = [];
  for (const candidate of waiting) {
    if (free <= 0) break;
    try {
      const plan = await findPlanForClass(context, candidate.memberId, classRow, policyOf(box));
      await consumeCredit(context, plan.id);
      const [booked] = await context.transaction
        .update(bookings)
        .set({ status: 'booked', waitlistPosition: null, memberPlanId: plan.id })
        .where(eq(bookings.id, candidate.id))
        .returning();
      if (booked) promoted.push(booked);
      free -= 1;
    } catch (error) {
      if (!(error instanceof ServiceError)) throw error;
    }
  }
  return promoted;
}

/** The signed-in member's bookings from `from` on, soonest first. */
export async function listOwnBookings(context: ServiceContext, from: Date) {
  const own = await getOwnMember(context);
  return context.transaction
    .select({ booking: bookings, class: classes })
    .from(bookings)
    .innerJoin(classes, eq(classes.id, bookings.classId))
    .where(
      and(
        eq(bookings.memberId, own.id),
        inArray(bookings.status, ACTIVE_STATUSES),
        gte(classes.startsAt, from),
      ),
    )
    .orderBy(asc(classes.startsAt));
}
