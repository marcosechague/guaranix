import { and, eq, inArray } from 'drizzle-orm';
import { bookings } from '@guaranix/db/schema';
import { currentBox } from './box-calendar';
import { SPOT_STATUSES, lockClass } from './bookings';
import { CLASS_STAFF_ROLES, assertRole, type ServiceContext } from './context';
import { consumeCredit, refundCredit } from './credits';
import { unprocessable } from './errors';

export interface AttendanceEntry {
  bookingId: string;
  status: 'attended' | 'no_show';
}

/**
 * Takes attendance for a class. The credit was spent at booking time, so a
 * no-show only changes credits when the box forgives no-shows: then marking
 * one gives the credit back, and correcting it to attended takes it again.
 */
export async function markAttendance(
  context: ServiceContext,
  classId: string,
  entries: AttendanceEntry[],
) {
  assertRole(context.auth.role, CLASS_STAFF_ROLES);
  const box = await currentBox(context);
  const classRow = await lockClass(context, classId);
  if (classRow.status === 'cancelled') throw unprocessable('class_cancelled');
  if (entries.some((entry) => entry.status === 'no_show') && context.now < classRow.startsAt) {
    throw unprocessable('class_not_started');
  }
  const rows = await context.transaction
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.classId, classRow.id),
        inArray(
          bookings.id,
          entries.map((entry) => entry.bookingId),
        ),
        inArray(bookings.status, SPOT_STATUSES),
      ),
    );
  if (rows.length !== new Set(entries.map((entry) => entry.bookingId)).size) {
    throw unprocessable('booking_not_in_class');
  }

  const updated = [];
  for (const entry of entries) {
    const booking = rows.find((row) => row.id === entry.bookingId);
    if (!booking || booking.status === entry.status) continue;
    if (booking.memberPlanId && !box.noShowConsumesCredit) {
      if (entry.status === 'no_show') await refundCredit(context, booking.memberPlanId);
      if (booking.status === 'no_show') await consumeCredit(context, booking.memberPlanId);
    }
    const [saved] = await context.transaction
      .update(bookings)
      .set({
        status: entry.status,
        checkedInAt: entry.status === 'attended' ? context.now : null,
      })
      .where(eq(bookings.id, booking.id))
      .returning();
    if (saved) updated.push(saved);
  }
  return updated;
}
