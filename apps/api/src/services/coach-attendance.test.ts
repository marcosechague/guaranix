import { and, eq } from 'drizzle-orm';
import { bookings, charges } from '@guaranix/db/schema';
import { addDays } from '@guaranix/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TODAY, bookingWorld, hoursFromNow } from '../testing/booking-helpers';
import { expectServiceError } from '../testing/expectations';
import { createServiceFixture, type ServiceFixture } from '../testing/service-fixture';
import { bookClass } from './bookings';
import { getClassRoster } from './classes';
import { addWalkIn, takeAttendance } from './coach-attendance';

let fixture: ServiceFixture;
let world: ReturnType<typeof bookingWorld>;

beforeAll(async () => {
  fixture = await createServiceFixture();
  world = bookingWorld(fixture, fixture.boxA);
});

beforeEach(async () => {
  await world.setPolicy({ bookingOpensHoursBefore: 168, checkInCoachEnabled: true });
});

afterAll(async () => {
  await fixture.close();
});

let day = 0;
/** Each test on its own day, with plans that start that day (selling one opens a charge due then). */
function freshDay() {
  day += 1;
  const now = hoursFromNow(day * 24);
  return {
    now,
    today: addDays(TODAY, day),
    at: (hours: number) => new Date(now.getTime() + hours * 3_600_000),
  };
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

describe('the coach takes attendance', () => {
  it('marks someone present from 30 minutes before the class, not earlier', async () => {
    const { now, today, at } = freshDay();
    const member = await world.memberWith(await world.createPlanOf({ kind: 'unlimited' }), today);
    const classRow = await world.createClass({ startsAt: at(1) });
    const booking = await member.act(
      (context) => bookClass(context, { classId: classRow.id }),
      now,
    );
    const entries = [{ bookingId: booking.id, status: 'attended' as const }];
    await expectServiceError(
      world.as('coach', (context) => takeAttendance(context, classRow.id, entries), at(0.4)),
      'check_in_not_open',
    );
    await world.as('coach', (context) => takeAttendance(context, classRow.id, entries), at(0.6));
    expect(await bookingOf(classRow.id, member.member.id)).toMatchObject({ status: 'attended' });
    // "Didn't come" still waits for the class to start.
    await expectServiceError(
      world.as(
        'coach',
        (context) =>
          takeAttendance(context, classRow.id, [{ bookingId: booking.id, status: 'no_show' }]),
        at(0.7),
      ),
      'class_not_started',
    );
  });

  it('is off for coaches when the box turned the list off, but owners can still fix it', async () => {
    const { now, today, at } = freshDay();
    const member = await world.memberWith(await world.createPlanOf({ kind: 'unlimited' }), today);
    const classRow = await world.createClass({ startsAt: at(0.1) });
    const booking = await member.act(
      (context) => bookClass(context, { classId: classRow.id }),
      now,
    );
    await world.setPolicy({ checkInCoachEnabled: false });
    const entries = [{ bookingId: booking.id, status: 'attended' as const }];
    await expectServiceError(
      world.as('coach', (context) => takeAttendance(context, classRow.id, entries), now),
      'check_in_mode_disabled',
    );
    await expectServiceError(
      world.as('coach', (context) => addWalkIn(context, classRow.id, member.member.id), now),
      'check_in_mode_disabled',
    );
    await world.as('box_owner', (context) => takeAttendance(context, classRow.id, entries), now);
    expect(await bookingOf(classRow.id, member.member.id)).toMatchObject({ status: 'attended' });
  });

  it('shows overdue fees on the list, like the entrance would', async () => {
    const { now, today, at } = freshDay();
    const member = await world.memberWith(await world.createPlanOf({ kind: 'unlimited' }), today);
    const classRow = await world.createClass({ startsAt: at(0.2) });
    await member.act((context) => bookClass(context, { classId: classRow.id }), now);
    await fixture.system((transaction) =>
      transaction.insert(charges).values({
        boxId: fixture.boxA.boxId,
        memberId: member.member.id,
        description: 'Cuota',
        amountGs: 180_000,
        dueOn: addDays(today, -2),
      }),
    );
    const { roster } = await world.as(
      'coach',
      (context) => getClassRoster(context, classRow.id),
      now,
    );
    expect(roster).toEqual([
      expect.objectContaining({
        memberId: member.member.id,
        owedGs: 180_000,
        memberInactive: false,
      }),
    ]);
  });
});

describe('someone came without booking', () => {
  it('takes a free spot and is marked present, even after the class started', async () => {
    const { now, today, at } = freshDay();
    const member = await world.memberWith(
      await world.createPlanOf({ kind: 'class_pack', classCount: 8 }),
      today,
    );
    const classRow = await world.createClass({ startsAt: at(-0.25) });
    const result = await world.as(
      'coach',
      (context) => addWalkIn(context, classRow.id, member.member.id),
      now,
    );
    expect(result).toMatchObject({ outcome: 'checked_in', walkIn: true });
    expect(await bookingOf(classRow.id, member.member.id)).toMatchObject({ status: 'attended' });
    const again = await world.as(
      'coach',
      (context) => addWalkIn(context, classRow.id, member.member.id),
      now,
    );
    expect(again).toMatchObject({ outcome: 'already_checked_in' });
  });

  it('says no, writing nothing, when the class is full, the fee is late or there is no plan', async () => {
    const { now, today, at } = freshDay();
    const unlimited = await world.createPlanOf({ kind: 'unlimited' });
    const full = await world.createClass({ startsAt: at(0.1), capacity: 1 });
    const first = await world.memberWith(unlimited, today);
    await first.act((context) => bookClass(context, { classId: full.id }), now);
    const late = await world.memberWith(unlimited, today);
    const planless = await world.memberWith(undefined, today);
    const open = await world.createClass({ startsAt: at(0.2) });
    await fixture.system((transaction) =>
      transaction.insert(charges).values({
        boxId: fixture.boxA.boxId,
        memberId: late.member.id,
        description: 'Cuota',
        amountGs: 90_000,
        dueOn: addDays(today, -1),
      }),
    );
    const walkIn = (classId: string, memberId: string) =>
      world.as('coach', (context) => addWalkIn(context, classId, memberId), now);

    expect(await walkIn(full.id, late.member.id)).toMatchObject({
      outcome: 'denied',
      reason: 'fee_overdue',
      owedGs: 90_000,
    });
    const other = await world.memberWith(unlimited, today);
    expect(await walkIn(full.id, other.member.id)).toMatchObject({ reason: 'class_full' });
    expect(await walkIn(open.id, planless.member.id)).toMatchObject({ reason: 'no_valid_plan' });
    expect(await bookingOf(open.id, planless.member.id)).toBeUndefined();
    expect(await bookingOf(full.id, other.member.id)).toBeUndefined();
  });

  it('only while the class is open for check-in, and only for staff', async () => {
    const { now, today, at } = freshDay();
    const member = await world.memberWith(await world.createPlanOf({ kind: 'unlimited' }), today);
    const later = await world.createClass({ startsAt: at(2) });
    await expectServiceError(
      world.as('coach', (context) => addWalkIn(context, later.id, member.member.id), now),
      'check_in_not_open',
    );
    await expectServiceError(
      member.act((context) => addWalkIn(context, later.id, member.member.id), now),
      'forbidden',
    );
  });
});
