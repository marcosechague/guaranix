import { and, eq } from 'drizzle-orm';
import { classSchedules, classes, memberPlans } from '@guaranix/db/schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TODAY, bookingWorld, hoursFromNow } from '../testing/booking-helpers';
import { expectServiceError } from '../testing/expectations';
import { createServiceFixture, type ServiceFixture } from '../testing/service-fixture';
import { markAttendance } from './attendance';
import { bookClass } from './bookings';
import { cancelClass, getClassRoster, listClasses, updateClass } from './classes';
import { createSchedule, generateClasses } from './schedules';

let fixture: ServiceFixture;
let world: ReturnType<typeof bookingWorld>;

beforeAll(async () => {
  fixture = await createServiceFixture();
  world = bookingWorld(fixture, fixture.boxA);
});

afterAll(async () => {
  await fixture.close();
});

async function creditsOf(memberPlanId: string | undefined) {
  const [plan] = await fixture.system((transaction) =>
    transaction
      .select()
      .from(memberPlans)
      .where(eq(memberPlans.id, memberPlanId ?? '')),
  );
  return plan?.classesRemaining;
}

describe('schedules and class generation', () => {
  it('generates classes at box-local times, once', async () => {
    const programId = await world.programId();
    const schedule = await world.as('box_owner', (context) =>
      createSchedule(context, {
        programId,
        coachUserId: fixture.boxA.userIds.coach,
        weekday: 2,
        startTime: '06:30',
        durationMinutes: 60,
        capacity: 12,
        validFrom: TODAY,
        validUntil: null,
      }),
    );
    const first = await world.as('box_owner', (context) =>
      generateClasses(context, { from: TODAY, days: 14 }),
    );
    const again = await world.as('box_owner', (context) =>
      generateClasses(context, { from: TODAY, days: 14 }),
    );
    expect(again.created).toBe(0);
    const generated = await fixture.system((transaction) =>
      transaction
        .select()
        .from(classes)
        .where(eq(classes.scheduleId, schedule.id))
        .orderBy(classes.startsAt),
    );
    expect(first.created).toBeGreaterThanOrEqual(generated.length);
    // Tuesdays 2031-03-04 and 2031-03-11 at 06:30 in Asunción (UTC-3).
    expect(generated.map((row) => row.startsAt.toISOString())).toEqual([
      '2031-03-04T09:30:00.000Z',
      '2031-03-11T09:30:00.000Z',
    ]);
    expect(generated[0]).toMatchObject({ capacity: 12, coachUserId: fixture.boxA.userIds.coach });
  });

  it('refuses coaches that are not staff of the box', async () => {
    const programId = await world.programId();
    await expectServiceError(
      world.as('box_owner', (context) =>
        createSchedule(context, {
          programId,
          coachUserId: fixture.boxB.userIds.coach,
          weekday: 1,
          startTime: '07:00',
          durationMinutes: 60,
          capacity: 10,
          validFrom: TODAY,
          validUntil: null,
        }),
      ),
      'coach_not_found',
    );
  });

  it('only managers create schedules or generate classes', async () => {
    for (const role of ['coach', 'reception', 'member'] as const) {
      await expectServiceError(
        world.as(role, (context) => generateClasses(context, { from: TODAY, days: 1 })),
        'forbidden',
      );
    }
  });

  it('never generates classes for another box', async () => {
    await world.as('box_owner', (context) => generateClasses(context, { from: TODAY, days: 7 }));
    const foreign = await fixture.system((transaction) =>
      transaction
        .select()
        .from(classes)
        .innerJoin(classSchedules, eq(classSchedules.id, classes.scheduleId))
        .where(
          and(eq(classes.boxId, fixture.boxB.boxId), eq(classSchedules.boxId, fixture.boxA.boxId)),
        ),
    );
    expect(foreign).toEqual([]);
  });
});

describe('class listing', () => {
  it('shows spots left, waitlist and the member’s own booking', async () => {
    const plan = await world.createPlanOf({ kind: 'unlimited' });
    const classRow = await world.createClass({ startsAt: hoursFromNow(26), capacity: 1 });
    const first = await world.memberWith(plan);
    const second = await world.memberWith(plan);
    await first.act((context) => bookClass(context, { classId: classRow.id }));
    await second.act((context) => bookClass(context, { classId: classRow.id }));
    const listed = await second.act((context) =>
      listClasses(context, { from: '2031-03-04', to: '2031-03-04' }),
    );
    const row = listed.find((candidate) => candidate.id === classRow.id);
    expect(row).toMatchObject({
      takenSpots: 1,
      spotsLeft: 0,
      waitlistCount: 1,
      programName: 'CrossFit',
      ownBooking: { status: 'waitlisted', waitlistPosition: 1 },
    });
    const other = bookingWorld(fixture, fixture.boxB);
    const foreign = await other.as('box_owner', (context) =>
      listClasses(context, { from: '2031-03-04', to: '2031-03-04' }),
    );
    expect(foreign.map((candidate) => candidate.id)).not.toContain(classRow.id);
  });

  it('limits the range', async () => {
    await expectServiceError(
      world.as('coach', (context) => listClasses(context, { from: TODAY, to: '2031-06-01' })),
      'date_range_invalid',
    );
  });

  it('shows the roster to staff only', async () => {
    const classRow = await world.createClass({ startsAt: hoursFromNow(5) });
    const roster = await world.as('coach', (context) => getClassRoster(context, classRow.id));
    expect(roster.roster).toEqual([]);
    await expectServiceError(
      world.as('member', (context) => getClassRoster(context, classRow.id)),
      'forbidden',
    );
  });
});

describe('attendance', () => {
  it('marks attendance and no-shows; forgiving no-shows gives the credit back', async () => {
    await world.setPolicy({ noShowConsumesCredit: false });
    const pack = await world.createPlanOf({ kind: 'class_pack', classCount: 5 });
    const classRow = await world.createClass({ startsAt: hoursFromNow(2) });
    const came = await world.memberWith(pack);
    const missed = await world.memberWith(pack);
    const cameBooking = await came.act((context) => bookClass(context, { classId: classRow.id }));
    const missedBooking = await missed.act((context) =>
      bookClass(context, { classId: classRow.id }),
    );
    await expectServiceError(
      world.as('coach', (context) =>
        markAttendance(context, classRow.id, [{ bookingId: missedBooking.id, status: 'no_show' }]),
      ),
      'class_not_started',
    );
    const afterClass = hoursFromNow(3.5);
    const marked = await world.as(
      'coach',
      (context) =>
        markAttendance(context, classRow.id, [
          { bookingId: cameBooking.id, status: 'attended' },
          { bookingId: missedBooking.id, status: 'no_show' },
        ]),
      afterClass,
    );
    expect(marked.map((booking) => booking.status).sort()).toEqual(['attended', 'no_show']);
    expect(await creditsOf(came.memberPlan?.id)).toBe(4);
    expect(await creditsOf(missed.memberPlan?.id)).toBe(5);

    // Correcting a no-show to attended takes the credit again.
    await world.as(
      'coach',
      (context) =>
        markAttendance(context, classRow.id, [{ bookingId: missedBooking.id, status: 'attended' }]),
      afterClass,
    );
    expect(await creditsOf(missed.memberPlan?.id)).toBe(4);
    await world.setPolicy({ noShowConsumesCredit: true });
  });

  it('keeps the credit on a no-show when the box charges them', async () => {
    const pack = await world.createPlanOf({ kind: 'class_pack', classCount: 2 });
    const classRow = await world.createClass({ startsAt: hoursFromNow(2) });
    const missed = await world.memberWith(pack);
    const booking = await missed.act((context) => bookClass(context, { classId: classRow.id }));
    await world.as(
      'reception',
      (context) =>
        markAttendance(context, classRow.id, [{ bookingId: booking.id, status: 'no_show' }]),
      hoursFromNow(4),
    );
    expect(await creditsOf(missed.memberPlan?.id)).toBe(1);
  });

  it('refuses bookings of other classes and is not for members', async () => {
    const plan = await world.createPlanOf({ kind: 'unlimited' });
    const one = await world.createClass({ startsAt: hoursFromNow(2) });
    const other = await world.createClass({ startsAt: hoursFromNow(2) });
    const { act } = await world.memberWith(plan);
    const booking = await act((context) => bookClass(context, { classId: one.id }));
    await expectServiceError(
      world.as('coach', (context) =>
        markAttendance(context, other.id, [{ bookingId: booking.id, status: 'attended' }]),
      ),
      'booking_not_in_class',
    );
    await expectServiceError(
      world.as('member', (context) =>
        markAttendance(context, one.id, [{ bookingId: booking.id, status: 'attended' }]),
      ),
      'forbidden',
    );
  });
});

describe('changing a class', () => {
  it('cancelling a class refunds booked credits but not waitlisted ones', async () => {
    const pack = await world.createPlanOf({ kind: 'class_pack', classCount: 3 });
    const classRow = await world.createClass({ startsAt: hoursFromNow(24), capacity: 1 });
    const booked = await world.memberWith(pack);
    const waiting = await world.memberWith(pack);
    await booked.act((context) => bookClass(context, { classId: classRow.id }));
    await waiting.act((context) => bookClass(context, { classId: classRow.id }));
    const result = await world.as('box_admin', (context) =>
      cancelClass(context, classRow.id, 'Feriado'),
    );
    expect(result).toMatchObject({
      cancelledBookings: 2,
      class: { status: 'cancelled', cancellationReason: 'Feriado' },
    });
    expect(await creditsOf(booked.memberPlan?.id)).toBe(3);
    expect(await creditsOf(waiting.memberPlan?.id)).toBe(3);
    await expectServiceError(
      booked.act((context) => bookClass(context, { classId: classRow.id })),
      'class_cancelled',
    );
  });

  it('more capacity fills from the waitlist; less than booked is refused', async () => {
    const plan = await world.createPlanOf({ kind: 'unlimited' });
    const classRow = await world.createClass({ startsAt: hoursFromNow(24), capacity: 1 });
    await (
      await world.memberWith(plan)
    ).act((context) => bookClass(context, { classId: classRow.id }));
    const waiter = await world.memberWith(plan);
    const waiting = await waiter.act((context) => bookClass(context, { classId: classRow.id }));
    const { promoted } = await world.as('box_owner', (context) =>
      updateClass(context, classRow.id, { capacity: 2 }),
    );
    expect(promoted.map((booking) => booking.id)).toEqual([waiting.id]);
    await expectServiceError(
      world.as('box_owner', (context) => updateClass(context, classRow.id, { capacity: 1 })),
      'capacity_below_bookings',
    );
  });

  it("another box can't cancel or change this box's classes", async () => {
    const classRow = await world.createClass({ startsAt: hoursFromNow(24) });
    const other = bookingWorld(fixture, fixture.boxB);
    await expectServiceError(
      other.as('box_owner', (context) => cancelClass(context, classRow.id, null)),
      'class_not_found',
    );
    await expectServiceError(
      other.as('box_owner', (context) => updateClass(context, classRow.id, { capacity: 50 })),
      'class_not_found',
    );
  });
});
