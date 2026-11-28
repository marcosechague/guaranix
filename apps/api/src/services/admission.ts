import type { bookings, classes, members } from '@guaranix/db/schema';
import { calendarDateIn } from '@guaranix/shared';
import { CHECK_IN_OPENS_MINUTES_BEFORE } from '@guaranix/shared/schemas';
import type { CheckInClass, CheckInDenial, CheckInMember } from '@guaranix/shared/schemas';
import { recordAttendance } from './attendance';
import { findPlanForClass } from './booking-eligibility';
import { currentBox } from './box-calendar';
import { overdueOwedBy } from './charges';
import type { ServiceContext } from './context';
import { ServiceError } from './errors';

/**
 * The rules every way of checking in shares (entrance, coach list, wall QR),
 * so a member who gets in one way gets in the others too.
 */

const MINUTE_MS = 60_000;

type ClassRow = typeof classes.$inferSelect;
type BookingRow = typeof bookings.$inferSelect;
type MemberRow = typeof members.$inferSelect;
export type Candidate = { class: ClassRow; programName: string; booking: BookingRow | null };

const PLAN_DENIALS = new Set<string>([
  'no_valid_plan',
  'plan_excludes_program',
  'no_credits_left',
  'weekly_limit_reached',
]);

export function classView(candidate: Candidate): CheckInClass {
  return {
    id: candidate.class.id,
    programName: candidate.programName,
    startsAt: candidate.class.startsAt.toISOString(),
  };
}

export function memberView(member: MemberRow): CheckInMember {
  return { id: member.id, firstName: member.firstName, lastName: member.lastName };
}

export function checkInOpensAt(classRow: ClassRow): Date {
  return new Date(classRow.startsAt.getTime() - CHECK_IN_OPENS_MINUTES_BEFORE * MINUTE_MS);
}

/** From 30 minutes before the class until it ends. */
export function isCheckInOpen(classRow: ClassRow, now: Date): boolean {
  return now >= checkInOpensAt(classRow) && now < classRow.endsAt;
}

export function checkInOpensBy(now: Date): Date {
  return new Date(now.getTime() + CHECK_IN_OPENS_MINUTES_BEFORE * MINUTE_MS);
}

/** Why the member can't come in today at all, whatever the class: not active, or owes a fee. */
export async function memberEntryBlock(
  context: ServiceContext,
  member: MemberRow,
): Promise<{ reason: CheckInDenial; owedGs: number | null } | null> {
  if (member.status !== 'active') return { reason: 'member_inactive', owedGs: null };
  const box = await currentBox(context);
  const owedGs = await overdueOwedBy(context, member.id, calendarDateIn(box.timezone, context.now));
  return owedGs > 0 ? { reason: 'fee_overdue', owedGs } : null;
}

/** The plan rule that keeps the member out of this class, if any. */
export async function planDenial(
  context: ServiceContext,
  memberId: string,
  classRow: ClassRow,
): Promise<CheckInDenial | null> {
  const box = await currentBox(context);
  try {
    await findPlanForClass(context, memberId, classRow, {
      timezone: box.timezone,
      lateCancelConsumesCredit: box.lateCancelConsumesCredit,
      noShowConsumesCredit: box.noShowConsumesCredit,
    });
    return null;
  } catch (error) {
    if (error instanceof ServiceError && PLAN_DENIALS.has(error.code)) {
      return error.code as CheckInDenial;
    }
    throw error;
  }
}

/** Marks a booked member as present in the class. */
export async function admit(context: ServiceContext, candidate: Candidate) {
  const booking = candidate.booking;
  if (!booking) throw new Error('Admitting a class without a booking');
  await recordAttendance(context, candidate.class.id, [
    { bookingId: booking.id, status: 'attended' },
  ]);
}
