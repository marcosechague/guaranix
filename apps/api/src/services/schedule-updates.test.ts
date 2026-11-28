import { eq } from 'drizzle-orm';
import { classes } from '@guaranix/db/schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NOW, TODAY, bookingWorld, hoursFromNow } from '../testing/booking-helpers';
import { expectServiceError } from '../testing/expectations';
import { createServiceFixture, type ServiceFixture } from '../testing/service-fixture';
import { bookClass } from './bookings';
import { updateSchedule } from './schedule-updates';
import { createSchedule } from './schedules';

let fixture: ServiceFixture;
let world: ReturnType<typeof bookingWorld>;

beforeAll(async () => {
  fixture = await createServiceFixture();
  world = bookingWorld(fixture, fixture.boxA);
  await world.setPolicy({ bookingOpensHoursBefore: 24 * 30 });
});

afterAll(async () => {
  await fixture.close();
});

async function scheduleWithClasses() {
  const programId = await world.programId();
  const schedule = await world.as('box_owner', (context) =>
    createSchedule(context, {
      programId,
      coachUserId: null,
      weekday: 1,
      startTime: '18:00',
      durationMinutes: 60,
      capacity: 3,
      validFrom: TODAY,
      validUntil: null,
    }),
  );
  const insert = (startsAt: Date) =>
    fixture.system(async (transaction) => {
      const [row] = await transaction
        .insert(classes)
        .values({
          boxId: fixture.boxA.boxId,
          programId,
          scheduleId: schedule.id,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 3_600_000),
          capacity: 3,
        })
        .returning();
      if (!row) throw new Error('Class was not created');
      return row;
    });
  const past = await insert(hoursFromNow(-48));
  const soon = await insert(hoursFromNow(6));
  const later = await insert(hoursFromNow(6 + 24 * 7));
  return { schedule, past, soon, later };
}

const capacityOf = async (classId: string) => {
  const [row] = await fixture.system((transaction) =>
    transaction.select().from(classes).where(eq(classes.id, classId)),
  );
  return row?.capacity;
};

describe('updating a weekly schedule', () => {
  it('is for owners and admins only', async () => {
    const { schedule } = await scheduleWithClasses();
    for (const role of ['coach', 'reception', 'member'] as const) {
      await expectServiceError(
        world.as(role, (context) => updateSchedule(context, schedule.id, { capacity: 10 })),
        'forbidden',
      );
    }
  });

  it('applies the new capacity to upcoming classes but not past ones', async () => {
    const { schedule, past, soon, later } = await scheduleWithClasses();
    const result = await world.as('box_admin', (context) =>
      updateSchedule(context, schedule.id, { capacity: 12 }),
    );
    expect(result.schedule.capacity).toBe(12);
    expect(result.updatedClasses).toBe(2);
    expect(await capacityOf(soon.id)).toBe(12);
    expect(await capacityOf(later.id)).toBe(12);
    expect(await capacityOf(past.id)).toBe(3);
  });

  it('never drops a class below the people already booked', async () => {
    const { schedule, soon, later } = await scheduleWithClasses();
    const plan = await world.createPlanOf({ kind: 'unlimited' });
    for (let index = 0; index < 3; index += 1) {
      const member = await world.memberWith(plan);
      await member.act((context) => bookClass(context, { classId: soon.id }), NOW);
    }
    await world.as('box_owner', (context) => updateSchedule(context, schedule.id, { capacity: 1 }));
    expect(await capacityOf(soon.id)).toBe(3);
    expect(await capacityOf(later.id)).toBe(1);
  });

  it('cannot touch another box schedule', async () => {
    const { schedule } = await scheduleWithClasses();
    await expectServiceError(
      fixture.as(fixture.boxB, 'box_owner', (context) =>
        updateSchedule(context, schedule.id, { capacity: 5 }),
      ),
      'schedule_not_found',
    );
  });
});
