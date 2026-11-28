import { and, asc, eq, gt, lte } from 'drizzle-orm';
import { bookings, classes, type members, programs } from '@guaranix/db/schema';
import type { CheckInDenial, CheckInPassView, CheckInResult } from '@guaranix/shared/schemas';
import {
  type Candidate,
  admit,
  checkInOpensBy,
  classView,
  memberEntryBlock,
  memberView,
  planDenial,
} from './admission';
import { assertCheckInModeEnabled } from './box-settings';
import { SPOT_STATUSES, bookClass, takenSpots } from './bookings';
import { signCheckInPass, verifyCheckInPass } from './check-in-pass';
import { CLASS_STAFF_ROLES, assertRole, type ServiceContext } from './context';
import { unprocessable } from './errors';
import { getMember, getOwnMember } from './members';

type MemberRow = typeof members.$inferSelect;

/** Classes open for check-in right now, with the member's booking in each, soonest first. */
async function candidateClasses(
  context: ServiceContext,
  memberId: string,
  locationId: string | null,
): Promise<Candidate[]> {
  const opensBy = checkInOpensBy(context.now);
  const rows = await context.transaction
    .select({ class: classes, programName: programs.name, booking: bookings })
    .from(classes)
    .innerJoin(programs, eq(programs.id, classes.programId))
    .leftJoin(bookings, and(eq(bookings.classId, classes.id), eq(bookings.memberId, memberId)))
    .where(
      and(
        eq(classes.status, 'scheduled'),
        lte(classes.startsAt, opensBy),
        gt(classes.endsAt, context.now),
        locationId ? eq(classes.locationId, locationId) : undefined,
      ),
    )
    .orderBy(asc(classes.startsAt));
  return rows;
}

/** Of the classes the member holds a spot in, the one closest to now. */
function bookedCandidate(candidates: Candidate[], now: Date): Candidate | undefined {
  const distance = (candidate: Candidate) =>
    Math.abs(candidate.class.startsAt.getTime() - now.getTime());
  return candidates
    .filter((candidate) =>
      (SPOT_STATUSES as readonly string[]).includes(candidate.booking?.status ?? ''),
    )
    .sort((first, second) => distance(first) - distance(second))[0];
}

/**
 * A member without a booking gets the next class that hasn't started, has a
 * free spot and is covered by their plan. Returns the denial that explains
 * why none worked, most specific first.
 */
async function walkIn(
  context: ServiceContext,
  memberId: string,
  candidates: Candidate[],
): Promise<{ booked: Candidate } | { reason: CheckInDenial; candidate: Candidate | null }> {
  const upcoming = candidates.filter((candidate) => candidate.class.startsAt > context.now);
  let reason: CheckInDenial = 'no_class_now';
  let reasonClass: Candidate | null = null;
  for (const candidate of upcoming) {
    if (candidate.booking?.status === 'waitlisted') {
      reason = 'waitlisted';
      reasonClass = candidate;
      continue;
    }
    const denial = await planDenial(context, memberId, candidate.class);
    if (denial) {
      if (reason === 'no_class_now' || reason === 'class_full') {
        reason = denial;
        reasonClass = candidate;
      }
      continue;
    }
    if ((await takenSpots(context, candidate.class.id)) >= candidate.class.capacity) {
      if (reason === 'no_class_now') {
        reason = 'class_full';
        reasonClass = candidate;
      }
      continue;
    }
    const booking = await bookClass(
      context,
      { classId: candidate.class.id, memberId },
      { notify: false },
    );
    // Someone took the last spot between the count and the booking: undo it all.
    if (booking.status !== 'booked') throw unprocessable('class_full');
    return { booked: { ...candidate, booking } };
  }
  return { reason, candidate: reasonClass };
}

/**
 * The entrance read a member's QR: let them in only with the fee up to date.
 * A booked member is marked as attended; one without a booking takes a free
 * spot in the next class their plan covers. A denial writes nothing and says
 * why, so the screen can tell the member what to fix.
 */
export async function checkInWithPass(
  context: ServiceContext,
  secret: string,
  pass: string,
): Promise<CheckInResult> {
  assertRole(context.auth.role, CLASS_STAFF_ROLES);
  await assertCheckInModeEnabled(context, 'desk');
  const memberId = await verifyCheckInPass(secret, context.auth.boxId, pass, context.now);
  return checkInMember(context, await getMember(context, memberId), null);
}

/**
 * Lets a member in, the same way whoever does the reading: fee up to date,
 * then the class they booked, or a free spot in the next one their plan covers.
 * `locationId` keeps the search to one location (the wall QR is per location).
 */
export async function checkInMember(
  context: ServiceContext,
  member: MemberRow,
  locationId: string | null,
): Promise<CheckInResult> {
  const who = memberView(member);
  const deny = (reason: CheckInDenial, candidate: Candidate | null, owedGs: number | null = null) =>
    ({
      outcome: 'denied',
      reason,
      member: who,
      class: candidate ? classView(candidate) : null,
      owedGs,
    }) satisfies CheckInResult;

  const block = await memberEntryBlock(context, member);
  if (block) return deny(block.reason, null, block.owedGs);

  const candidates = await candidateClasses(context, member.id, locationId);
  const booked = bookedCandidate(candidates, context.now);
  if (booked) {
    if (booked.booking?.status === 'attended') {
      return {
        outcome: 'already_checked_in',
        member: who,
        class: classView(booked),
        walkIn: false,
      };
    }
    await admit(context, booked);
    return { outcome: 'checked_in', member: who, class: classView(booked), walkIn: false };
  }

  const result = await walkIn(context, member.id, candidates);
  if ('reason' in result) return deny(result.reason, result.candidate);
  await admit(context, result.booked);
  return { outcome: 'checked_in', member: who, class: classView(result.booked), walkIn: true };
}

/** The signed-in member's entry QR. Someone dado de baja gets none. */
export async function issueOwnCheckInPass(
  context: ServiceContext,
  secret: string,
): Promise<CheckInPassView> {
  const member = await getOwnMember(context);
  await assertCheckInModeEnabled(context, 'desk');
  if (member.status !== 'active') throw unprocessable('member_inactive');
  const { pass, expiresAt } = await signCheckInPass(
    secret,
    context.auth.boxId,
    member.id,
    context.now,
  );
  return { pass, expiresAt: expiresAt.toISOString() };
}
