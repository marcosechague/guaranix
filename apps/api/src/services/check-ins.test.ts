import { and, eq } from 'drizzle-orm';
import { bookings, charges, memberPlans, members } from '@guaranix/db/schema';
import { addDays } from '@guaranix/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TODAY, bookingWorld, hoursFromNow } from '../testing/booking-helpers';
import { expectServiceError } from '../testing/expectations';
import { createServiceFixture, type ServiceFixture } from '../testing/service-fixture';
import { bookClass } from './bookings';
import { signCheckInPass } from './check-in-pass';
import { checkInWithPass, issueOwnCheckInPass } from './check-ins';

const SECRET = 'test-auth-secret';

let fixture: ServiceFixture;
let world: ReturnType<typeof bookingWorld>;
let otherWorld: ReturnType<typeof bookingWorld>;

beforeAll(async () => {
  fixture = await createServiceFixture();
  world = bookingWorld(fixture, fixture.boxA);
  otherWorld = bookingWorld(fixture, fixture.boxB);
});

beforeEach(async () => {
  await world.setPolicy({
    bookingOpensHoursBefore: 168,
    bookingClosesMinutesBefore: 0,
    checkInDeskEnabled: true,
  });
  await otherWorld.setPolicy({ checkInDeskEnabled: true });
});

afterAll(async () => {
  await fixture.close();
});

type Member = Awaited<ReturnType<typeof world.memberWith>>;

async function passOf(member: Member, now: Date) {
  const { pass } = await member.act((context) => issueOwnCheckInPass(context, SECRET), now);
  return pass;
}

function scan(pass: string, now: Date) {
  return world.as('reception', (context) => checkInWithPass(context, SECRET, pass), now);
}

async function bookingOf(classId: string, memberId: string) {
  const [row] = await fixture.system((transaction) =>
    transaction
      .select()
      .from(bookings)
      .where(and(eq(bookings.classId, classId), eq(bookings.memberId, memberId))),
  );
  return row;
}

let day = 0;
/** Each test runs on its own day, so classes from other tests are never in the window. */
function freshDay() {
  day += 1;
  const now = hoursFromNow(day * 24);
  // Plans start that day too: selling one opens a charge due on its first day.
  const today = addDays(TODAY, day);
  return { now, today, at: (hours: number) => new Date(now.getTime() + hours * 3_600_000) };
}

describe('check-in with a booking', () => {
  it('marks the booked class as attended, and says so again on a second scan', async () => {
    const { now, at, today } = freshDay();
    const member = await world.memberWith(await world.createPlanOf({ kind: 'unlimited' }), today);
    const classRow = await world.createClass({ startsAt: at(0.25) });
    await member.act((context) => bookClass(context, { classId: classRow.id }), now);

    const result = await scan(await passOf(member, now), now);
    expect(result).toMatchObject({
      outcome: 'checked_in',
      walkIn: false,
      member: { id: member.member.id },
      class: { id: classRow.id, programName: 'CrossFit' },
    });
    expect(await bookingOf(classRow.id, member.member.id)).toMatchObject({
      status: 'attended',
      checkedInAt: now,
    });

    const again = await scan(await passOf(member, at(0.1)), at(0.1));
    expect(again).toMatchObject({ outcome: 'already_checked_in' });
  });

  it('lets a booked member in after the class started, until it ends', async () => {
    const { now, at, today } = freshDay();
    const member = await world.memberWith(await world.createPlanOf({ kind: 'unlimited' }), today);
    const classRow = await world.createClass({ startsAt: at(1) });
    await member.act((context) => bookClass(context, { classId: classRow.id }), now);
    const late = at(1.5);
    expect(await scan(await passOf(member, late), late)).toMatchObject({
      outcome: 'checked_in',
      class: { id: classRow.id },
    });
  });
});

describe('check-in without a booking', () => {
  it('takes a free spot in the next class and spends the pack credit', async () => {
    const { now, at, today } = freshDay();
    const member = await world.memberWith(
      await world.createPlanOf({ kind: 'class_pack', classCount: 3 }),
      today,
    );
    const classRow = await world.createClass({ startsAt: at(0.4) });
    const result = await scan(await passOf(member, now), now);
    expect(result).toMatchObject({ outcome: 'checked_in', walkIn: true });
    expect(await bookingOf(classRow.id, member.member.id)).toMatchObject({ status: 'attended' });
    const [plan] = await fixture.system((transaction) =>
      transaction
        .select()
        .from(memberPlans)
        .where(eq(memberPlans.id, member.memberPlan?.id ?? '')),
    );
    expect(plan?.classesRemaining).toBe(2);
  });

  it('says the class is full instead of joining the waitlist', async () => {
    const { now, at, today } = freshDay();
    const plan = await world.createPlanOf({ kind: 'unlimited' });
    const first = await world.memberWith(plan, today);
    const second = await world.memberWith(plan, today);
    const classRow = await world.createClass({ startsAt: at(0.3), capacity: 1 });
    await first.act((context) => bookClass(context, { classId: classRow.id }), now);
    expect(await scan(await passOf(second, now), now)).toMatchObject({
      outcome: 'denied',
      reason: 'class_full',
      class: { id: classRow.id },
    });
    expect(await bookingOf(classRow.id, second.member.id)).toBeUndefined();
  });

  it('denies without a valid plan, or when no class is about to start', async () => {
    const { now, at, today } = freshDay();
    const noPlan = await world.memberWith();
    await world.createClass({ startsAt: at(0.2) });
    expect(await scan(await passOf(noPlan, now), now)).toMatchObject({
      outcome: 'denied',
      reason: 'no_valid_plan',
    });

    const withPlan = await world.memberWith(await world.createPlanOf({ kind: 'unlimited' }), today);
    const tooEarly = at(-3);
    expect(await scan(await passOf(withPlan, tooEarly), tooEarly)).toMatchObject({
      outcome: 'denied',
      reason: 'no_class_now',
      class: null,
    });
  });
});

describe('fee up to date', () => {
  it('denies a member with an overdue charge, booking or not, and writes nothing', async () => {
    const { now, at, today } = freshDay();
    const member = await world.memberWith(await world.createPlanOf({ kind: 'unlimited' }), today);
    const classRow = await world.createClass({ startsAt: at(0.1) });
    await member.act((context) => bookClass(context, { classId: classRow.id }), now);
    const charge = { boxId: fixture.boxA.boxId, memberId: member.member.id, description: 'Cuota' };
    await fixture.system((transaction) =>
      transaction.insert(charges).values([
        { ...charge, amountGs: 250_000, dueOn: addDays(today, -3) },
        // Due today is not late yet.
        { ...charge, amountGs: 100_000, dueOn: today },
      ]),
    );
    expect(await scan(await passOf(member, now), now)).toMatchObject({
      outcome: 'denied',
      reason: 'fee_overdue',
      owedGs: 250_000,
    });
    expect(await bookingOf(classRow.id, member.member.id)).toMatchObject({ status: 'booked' });
  });

  it('denies a member who was dado de baja after getting the QR', async () => {
    const { now, at, today } = freshDay();
    const member = await world.memberWith(await world.createPlanOf({ kind: 'unlimited' }), today);
    await world.createClass({ startsAt: at(0.1) });
    const pass = await passOf(member, now);
    await fixture.system((transaction) =>
      transaction
        .update(members)
        .set({ status: 'inactive' })
        .where(eq(members.id, member.member.id)),
    );
    expect(await scan(pass, now)).toMatchObject({ outcome: 'denied', reason: 'member_inactive' });
    await expectServiceError(
      member.act((context) => issueOwnCheckInPass(context, SECRET), now),
      'member_inactive',
    );
  });
});

describe('the pass', () => {
  it('expires, and a changed or made-up pass is rejected', async () => {
    const { now, at, today } = freshDay();
    const member = await world.memberWith(await world.createPlanOf({ kind: 'unlimited' }), today);
    await world.createClass({ startsAt: at(0.2) });
    const pass = await passOf(member, now);
    expect(await scan(pass, at(1 / 60))).toMatchObject({ outcome: 'checked_in' });
    await expectServiceError(scan(pass, at(121 / 3600)), 'check_in_pass_expired');

    const [version, , expiry, signature] = pass.split('.');
    const forged = [version, fixture.boxA.memberId, expiry, signature].join('.');
    await expectServiceError(scan(forged, now), 'check_in_pass_invalid');
    await expectServiceError(scan('gx1.not-a-member.zz.sig', now), 'check_in_pass_invalid');
    const wrongSecret = await signCheckInPass('other', fixture.boxA.boxId, member.member.id, now);
    await expectServiceError(scan(wrongSecret.pass, now), 'check_in_pass_invalid');
  });

  it("doesn't open another box's entrance", async () => {
    const { now, at, today } = freshDay();
    const foreign = await otherWorld.memberWith(
      await otherWorld.createPlanOf({ kind: 'unlimited' }),
      today,
    );
    await world.createClass({ startsAt: at(0.1) });
    await expectServiceError(scan(await passOf(foreign, now), now), 'check_in_pass_invalid');
    // Even a pass signed for box A with B's member id finds nobody.
    const crafted = await signCheckInPass(SECRET, fixture.boxA.boxId, foreign.member.id, now);
    await expectServiceError(scan(crafted.pass, now), 'member_not_found');
  });

  it('only staff can scan', async () => {
    const { now, today } = freshDay();
    const member = await world.memberWith(await world.createPlanOf({ kind: 'unlimited' }), today);
    const pass = await passOf(member, now);
    await expectServiceError(
      member.act((context) => checkInWithPass(context, SECRET, pass), now),
      'forbidden',
    );
  });

  it('stops working when the box turns the entrance off in Ajustes', async () => {
    const { now, today } = freshDay();
    const member = await world.memberWith(await world.createPlanOf({ kind: 'unlimited' }), today);
    const pass = await passOf(member, now);
    await world.setPolicy({ checkInDeskEnabled: false });
    await expectServiceError(scan(pass, now), 'check_in_mode_disabled');
    await expectServiceError(passOf(member, now), 'check_in_mode_disabled');
  });
});
