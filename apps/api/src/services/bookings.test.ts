import { eq } from 'drizzle-orm';
import { memberPlans, planPrograms } from '@guaranix/db/schema';
import { addDays } from '@guaranix/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TODAY, bookingWorld, hoursFromNow } from '../testing/booking-helpers';
import { expectServiceError } from '../testing/expectations';
import { createServiceFixture, type ServiceFixture } from '../testing/service-fixture';
import { bookClass, cancelBooking } from './bookings';
import { pauseMemberPlan } from './member-plans';

let fixture: ServiceFixture;
let world: ReturnType<typeof bookingWorld>;

beforeAll(async () => {
  fixture = await createServiceFixture();
  world = bookingWorld(fixture, fixture.boxA);
});

beforeEach(async () => {
  await world.setPolicy({
    bookingOpensHoursBefore: 168,
    bookingClosesMinutesBefore: 0,
    lateCancelMinutesBefore: 120,
    lateCancelConsumesCredit: true,
    noShowConsumesCredit: true,
    waitlistAutoPromote: true,
  });
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

describe('booking a class', () => {
  it('books with an unlimited plan in one call', async () => {
    const plan = await world.createPlanOf({ kind: 'unlimited' });
    const { act, memberPlan } = await world.memberWith(plan);
    const classRow = await world.createClass({ startsAt: hoursFromNow(24) });
    const booking = await act((context) => bookClass(context, { classId: classRow.id }));
    expect(booking).toMatchObject({
      status: 'booked',
      memberPlanId: memberPlan?.id,
      waitlistPosition: null,
    });
  });

  it('spends a pack credit, and gives it back on a timely cancellation', async () => {
    const pack = await world.createPlanOf({ kind: 'class_pack', classCount: 2 });
    const { act, memberPlan } = await world.memberWith(pack);
    const classRow = await world.createClass({ startsAt: hoursFromNow(24) });
    const booking = await act((context) => bookClass(context, { classId: classRow.id }));
    expect(await creditsOf(memberPlan?.id)).toBe(1);
    const { booking: cancelled } = await act((context) => cancelBooking(context, booking.id));
    expect(cancelled.status).toBe('cancelled');
    expect(await creditsOf(memberPlan?.id)).toBe(2);
  });

  it('keeps the credit on a late cancellation unless the box forgives it', async () => {
    const pack = await world.createPlanOf({ kind: 'class_pack', classCount: 5 });
    const { act, memberPlan } = await world.memberWith(pack);
    const soon = await world.createClass({ startsAt: hoursFromNow(1) });
    const booking = await act((context) => bookClass(context, { classId: soon.id }));
    const { booking: late } = await act((context) => cancelBooking(context, booking.id));
    expect(late.status).toBe('late_cancelled');
    expect(await creditsOf(memberPlan?.id)).toBe(4);

    await world.setPolicy({ lateCancelConsumesCredit: false });
    const other = await world.createClass({ startsAt: hoursFromNow(1.5) });
    const second = await act((context) => bookClass(context, { classId: other.id }));
    await act((context) => cancelBooking(context, second.id));
    expect(await creditsOf(memberPlan?.id)).toBe(4);
  });

  it('lets staff forgive a late cancellation, but not members', async () => {
    const pack = await world.createPlanOf({ kind: 'class_pack', classCount: 3 });
    const { act, memberPlan } = await world.memberWith(pack);
    const soon = await world.createClass({ startsAt: hoursFromNow(1) });
    const first = await act((context) => bookClass(context, { classId: soon.id }));
    await act((context) => cancelBooking(context, first.id, { forgiveLateCancel: true }));
    expect(await creditsOf(memberPlan?.id)).toBe(2);

    const again = await act((context) => bookClass(context, { classId: soon.id }));
    const { booking } = await world.as('reception', (context) =>
      cancelBooking(context, again.id, { forgiveLateCancel: true }),
    );
    expect(booking.status).toBe('cancelled');
    expect(await creditsOf(memberPlan?.id)).toBe(2);
  });

  it('refuses to book when there are no credits left', async () => {
    const dropIn = await world.createPlanOf({ kind: 'drop_in', classCount: 1 });
    const { act } = await world.memberWith(dropIn);
    const first = await world.createClass({ startsAt: hoursFromNow(24) });
    const second = await world.createClass({ startsAt: hoursFromNow(48) });
    await act((context) => bookClass(context, { classId: first.id }));
    await expectServiceError(
      act((context) => bookClass(context, { classId: second.id })),
      'no_credits_left',
    );
  });

  it('enforces weekly limits Monday to Sunday, counting late cancellations', async () => {
    const twice = await world.createPlanOf({ kind: 'weekly_limit', classesPerWeek: 2 });
    const { act } = await world.memberWith(twice);
    const tuesday = await world.createClass({ startsAt: hoursFromNow(24) });
    const wednesday = await world.createClass({ startsAt: hoursFromNow(48) });
    const thursday = await world.createClass({ startsAt: hoursFromNow(72) });
    const nextMonday = await world.createClass({ startsAt: hoursFromNow(7 * 24) });
    await act((context) => bookClass(context, { classId: tuesday.id }));
    const late = await act((context) => bookClass(context, { classId: wednesday.id }));
    await act((context) => cancelBooking(context, late.id), hoursFromNow(47));
    await expectServiceError(
      act((context) => bookClass(context, { classId: thursday.id })),
      'weekly_limit_reached',
    );
    const nextWeek = await act((context) => bookClass(context, { classId: nextMonday.id }));
    expect(nextWeek.status).toBe('booked');
  });

  it('refuses paused plans and programs the plan does not cover', async () => {
    const plan = await world.createPlanOf({ kind: 'unlimited' });
    const paused = await world.memberWith(plan);
    await world.as('reception', (context) =>
      pauseMemberPlan(context, paused.memberPlan?.id ?? '', {
        startsOn: TODAY,
        endsOn: addDays(TODAY, 3),
        reason: null,
      }),
    );
    const tomorrow = await world.createClass({ startsAt: hoursFromNow(24) });
    await expectServiceError(
      paused.act((context) => bookClass(context, { classId: tomorrow.id })),
      'no_valid_plan',
    );

    const crossfitOnly = await world.createPlanOf({ kind: 'unlimited' });
    await fixture.system((transaction) =>
      transaction.insert(planPrograms).values({
        boxId: fixture.boxA.boxId,
        planId: crossfitOnly.id,
        programId: tomorrow.programId,
      }),
    );
    const { act } = await world.memberWith(crossfitOnly);
    const openBox = await world.createClass({ startsAt: hoursFromNow(24), program: 'Open Box' });
    await expectServiceError(
      act((context) => bookClass(context, { classId: openBox.id })),
      'plan_excludes_program',
    );
    expect((await act((context) => bookClass(context, { classId: tomorrow.id }))).status).toBe(
      'booked',
    );
  });

  it('refuses members without a plan', async () => {
    const { act } = await world.memberWith();
    const classRow = await world.createClass({ startsAt: hoursFromNow(24) });
    await expectServiceError(
      act((context) => bookClass(context, { classId: classRow.id })),
      'no_valid_plan',
    );
  });

  it('applies the booking window to members but lets staff book anyone', async () => {
    await world.setPolicy({ bookingOpensHoursBefore: 24, bookingClosesMinutesBefore: 30 });
    const plan = await world.createPlanOf({ kind: 'unlimited' });
    const { act, member } = await world.memberWith(plan);
    const far = await world.createClass({ startsAt: hoursFromNow(48) });
    const near = await world.createClass({ startsAt: hoursFromNow(0.25) });
    await expectServiceError(
      act((context) => bookClass(context, { classId: far.id })),
      'booking_not_open',
    );
    await expectServiceError(
      act((context) => bookClass(context, { classId: near.id })),
      'booking_closed',
    );
    const byStaff = await world.as('reception', (context) =>
      bookClass(context, { classId: near.id, memberId: member.id }),
    );
    expect(byStaff.status).toBe('booked');
  });

  it('refuses started or cancelled classes and double bookings', async () => {
    const plan = await world.createPlanOf({ kind: 'unlimited' });
    const { act } = await world.memberWith(plan);
    const started = await world.createClass({ startsAt: hoursFromNow(-0.5) });
    await expectServiceError(
      act((context) => bookClass(context, { classId: started.id })),
      'class_started',
    );
    const classRow = await world.createClass({ startsAt: hoursFromNow(24) });
    const first = await act((context) => bookClass(context, { classId: classRow.id }));
    await expectServiceError(
      act((context) => bookClass(context, { classId: classRow.id })),
      'already_booked',
    );
    await act((context) => cancelBooking(context, first.id));
    const again = await act((context) => bookClass(context, { classId: classRow.id }));
    expect(again.id).toBe(first.id);
    expect(again.status).toBe('booked');
  });
});

describe('waitlist', () => {
  it('queues when full and promotes in order when a spot frees up, spending the credit then', async () => {
    const pack = await world.createPlanOf({ kind: 'class_pack', classCount: 5 });
    const classRow = await world.createClass({ startsAt: hoursFromNow(24), capacity: 1 });
    const first = await world.memberWith(pack);
    const second = await world.memberWith(pack);
    const third = await world.memberWith(pack);
    const booked = await first.act((context) => bookClass(context, { classId: classRow.id }));
    const waiting = await second.act((context) => bookClass(context, { classId: classRow.id }));
    const waitingToo = await third.act((context) => bookClass(context, { classId: classRow.id }));
    expect([waiting.status, waiting.waitlistPosition]).toEqual(['waitlisted', 1]);
    expect(waitingToo.waitlistPosition).toBe(2);
    expect(await creditsOf(second.memberPlan?.id)).toBe(5);

    const { promoted } = await first.act((context) => cancelBooking(context, booked.id));
    expect(promoted.map((booking) => booking.id)).toEqual([waiting.id]);
    expect(promoted[0]).toMatchObject({ status: 'booked', waitlistPosition: null });
    expect(await creditsOf(second.memberPlan?.id)).toBe(4);
    expect(await creditsOf(third.memberPlan?.id)).toBe(5);
  });

  it('skips people who can no longer pay for the class', async () => {
    const dropIn = await world.createPlanOf({ kind: 'drop_in', classCount: 1 });
    const pack = await world.createPlanOf({ kind: 'class_pack', classCount: 3 });
    const full = await world.createClass({ startsAt: hoursFromNow(30), capacity: 1 });
    const other = await world.createClass({ startsAt: hoursFromNow(20), capacity: 5 });
    const holder = await world.memberWith(pack);
    const broke = await world.memberWith(dropIn);
    const next = await world.memberWith(pack);
    const held = await holder.act((context) => bookClass(context, { classId: full.id }));
    await broke.act((context) => bookClass(context, { classId: full.id }));
    const nextWaiting = await next.act((context) => bookClass(context, { classId: full.id }));
    // The drop-in's only credit goes to another class while waiting.
    await broke.act((context) => bookClass(context, { classId: other.id }));
    const { promoted } = await holder.act((context) => cancelBooking(context, held.id));
    expect(promoted.map((booking) => booking.id)).toEqual([nextWaiting.id]);
  });

  it('does not promote when the box turned auto-promotion off', async () => {
    await world.setPolicy({ waitlistAutoPromote: false });
    const plan = await world.createPlanOf({ kind: 'unlimited' });
    const classRow = await world.createClass({ startsAt: hoursFromNow(24), capacity: 1 });
    const first = await world.memberWith(plan);
    const second = await world.memberWith(plan);
    const booked = await first.act((context) => bookClass(context, { classId: classRow.id }));
    await second.act((context) => bookClass(context, { classId: classRow.id }));
    const { promoted } = await first.act((context) => cancelBooking(context, booked.id));
    expect(promoted).toEqual([]);
  });

  it('leaving the waitlist spends nothing', async () => {
    const pack = await world.createPlanOf({ kind: 'class_pack', classCount: 2 });
    const classRow = await world.createClass({ startsAt: hoursFromNow(24), capacity: 1 });
    await (
      await world.memberWith(pack)
    ).act((context) => bookClass(context, { classId: classRow.id }));
    const waiter = await world.memberWith(pack);
    const waiting = await waiter.act((context) => bookClass(context, { classId: classRow.id }));
    const { booking } = await waiter.act(
      (context) => cancelBooking(context, waiting.id),
      hoursFromNow(23.5),
    );
    expect(booking).toMatchObject({ status: 'cancelled', waitlistPosition: null });
    expect(await creditsOf(waiter.memberPlan?.id)).toBe(2);
  });
});

describe('who can book and cancel', () => {
  it("members can't book for or cancel someone else", async () => {
    const plan = await world.createPlanOf({ kind: 'unlimited' });
    const alice = await world.memberWith(plan);
    const bruno = await world.memberWith(plan);
    const classRow = await world.createClass({ startsAt: hoursFromNow(24) });
    await expectServiceError(
      alice.act((context) =>
        bookClass(context, { classId: classRow.id, memberId: bruno.member.id }),
      ),
      'member_not_found',
    );
    const brunosBooking = await bruno.act((context) =>
      bookClass(context, { classId: classRow.id }),
    );
    await expectServiceError(
      alice.act((context) => cancelBooking(context, brunosBooking.id)),
      'booking_not_found',
    );
  });

  it('staff must say which member they book for', async () => {
    const classRow = await world.createClass({ startsAt: hoursFromNow(24) });
    await expectServiceError(
      world.as('reception', (context) => bookClass(context, { classId: classRow.id })),
      'member_required',
    );
  });

  it("another box can't book, see or cancel this box's classes", async () => {
    const plan = await world.createPlanOf({ kind: 'unlimited' });
    const local = await world.memberWith(plan);
    const classRow = await world.createClass({ startsAt: hoursFromNow(24) });
    const booking = await local.act((context) => bookClass(context, { classId: classRow.id }));
    const other = bookingWorld(fixture, fixture.boxB);
    const foreignPlan = await other.createPlanOf({ kind: 'unlimited' });
    const foreigner = await other.memberWith(foreignPlan);
    await expectServiceError(
      foreigner.act((context) => bookClass(context, { classId: classRow.id })),
      'class_not_found',
    );
    await expectServiceError(
      other.as('box_owner', (context) => cancelBooking(context, booking.id)),
      'booking_not_found',
    );
    await expectServiceError(
      other.as('box_owner', (context) =>
        bookClass(context, { classId: classRow.id, memberId: local.member.id }),
      ),
      'member_not_found',
    );
  });
});
