import { bookings, classes, members, programs } from '@guaranix/db/schema';
import type { CheckInDenial, CheckInResult } from '@guaranix/shared/schemas';
import { and, eq } from 'drizzle-orm';
import {
  type Candidate,
  admit,
  checkInOpensAt,
  classView,
  isCheckInOpen,
  memberEntryBlock,
  memberView,
  planDenial,
} from './admission';
import { type AttendanceEntry, markAttendance } from './attendance';
import { SPOT_STATUSES, bookClass, takenSpots } from './bookings';
import { assertCheckInModeEnabled } from './box-settings';
import { CLASS_STAFF_ROLES, MANAGER_ROLES, assertRole, type ServiceContext } from './context';
import { notFound, unprocessable } from './errors';
import { getMember } from './members';

const isSpot = (status: string | undefined) =>
  (SPOT_STATUSES as readonly string[]).includes(status ?? '');

/**
 * The coach's list follows the box's choice in Ajustes; owners and admins can
 * always fix attendance, whatever way the box uses.
 */
async function assertCoachListAllowed(context: ServiceContext) {
  if ((MANAGER_ROLES as readonly string[]).includes(context.auth.role)) return;
  await assertCheckInModeEnabled(context, 'coach');
}

async function classCandidate(
  context: ServiceContext,
  classId: string,
  memberId: string,
): Promise<Candidate> {
  const [row] = await context.transaction
    .select({ class: classes, programName: programs.name, booking: bookings })
    .from(classes)
    .innerJoin(programs, eq(programs.id, classes.programId))
    .leftJoin(bookings, and(eq(bookings.classId, classes.id), eq(bookings.memberId, memberId)))
    .where(eq(classes.id, classId));
  if (!row) throw notFound('class');
  return row;
}

function assertOpenForCheckIn(context: ServiceContext, candidate: Candidate) {
  if (candidate.class.status === 'cancelled') throw unprocessable('class_cancelled');
  if (!isCheckInOpen(candidate.class, context.now)) throw unprocessable('check_in_not_open');
}

/**
 * The coach marks who came. "Came" can be marked from 30 minutes before the
 * class, like at the entrance; "didn't come" only once it started.
 */
export async function takeAttendance(
  context: ServiceContext,
  classId: string,
  entries: AttendanceEntry[],
) {
  assertRole(context.auth.role, CLASS_STAFF_ROLES);
  await assertCoachListAllowed(context);
  const [classRow] = await context.transaction
    .select()
    .from(classes)
    .where(eq(classes.id, classId));
  if (!classRow) throw notFound('class');
  const tooEarly = context.now < checkInOpensAt(classRow);
  if (tooEarly && entries.some((entry) => entry.status === 'attended')) {
    throw unprocessable('check_in_not_open');
  }
  return markAttendance(context, classId, entries);
}

/**
 * Someone came without booking: same rules as the entrance (active, fee up to
 * date, a plan that covers the class, a free spot), and the coach can add them
 * after the class began. A "no" writes nothing and says why.
 */
export async function addWalkIn(
  context: ServiceContext,
  classId: string,
  memberId: string,
): Promise<CheckInResult> {
  assertRole(context.auth.role, CLASS_STAFF_ROLES);
  await assertCoachListAllowed(context);
  const member = await getMember(context, memberId);
  const candidate = await classCandidate(context, classId, member.id);
  assertOpenForCheckIn(context, candidate);
  const who = memberView(member);
  const deny = (reason: CheckInDenial, owedGs: number | null = null): CheckInResult => ({
    outcome: 'denied',
    reason,
    member: who,
    class: classView(candidate),
    owedGs,
  });

  if (isSpot(candidate.booking?.status)) {
    if (candidate.booking?.status === 'attended') {
      return {
        outcome: 'already_checked_in',
        member: who,
        class: classView(candidate),
        walkIn: false,
      };
    }
    await admit(context, candidate);
    return { outcome: 'checked_in', member: who, class: classView(candidate), walkIn: false };
  }
  const block = await memberEntryBlock(context, member);
  if (block) return deny(block.reason, block.owedGs);
  if (candidate.booking?.status === 'waitlisted') return deny('waitlisted');
  const plan = await planDenial(context, member.id, candidate.class);
  if (plan) return deny(plan);
  if ((await takenSpots(context, candidate.class.id)) >= candidate.class.capacity) {
    return deny('class_full');
  }
  const booking = await bookClass(
    context,
    { classId: candidate.class.id, memberId: member.id },
    { notify: false, allowStarted: true },
  );
  if (booking.status !== 'booked') throw unprocessable('class_full');
  await admit(context, { ...candidate, booking });
  return { outcome: 'checked_in', member: who, class: classView(candidate), walkIn: true };
}

/** What the coach should know about each person on the list before letting them train. */
export async function rosterWarnings(
  context: ServiceContext,
  memberIds: string[],
): Promise<Map<string, { owedGs: number; inactive: boolean }>> {
  const warnings = new Map<string, { owedGs: number; inactive: boolean }>();
  for (const memberId of new Set(memberIds)) {
    const [member] = await context.transaction
      .select()
      .from(members)
      .where(eq(members.id, memberId));
    if (!member) continue;
    const block = await memberEntryBlock(context, member);
    warnings.set(memberId, {
      owedGs: block?.reason === 'fee_overdue' ? (block.owedGs ?? 0) : 0,
      inactive: block?.reason === 'member_inactive',
    });
  }
  return warnings;
}
