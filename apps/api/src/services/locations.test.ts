import { eq } from 'drizzle-orm';
import { auditLogs, boxes, classSchedules, classes } from '@guaranix/db/schema';
import { classScheduleSchema, createLocationSchema } from '@guaranix/shared/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookingWorld, hoursFromNow } from '../testing/booking-helpers';
import { expectServiceError } from '../testing/expectations';
import { createServiceFixture, type ServiceFixture } from '../testing/service-fixture';
import { bookClass } from './bookings';
import { createClassesFromSchedules } from './class-generation';
import { createPlan, listPlans } from './plans';
import { createLocation, defaultLocation, listLocations, updateLocation } from './locations';
import { createSchedule, endSchedule } from './schedules';
import { listClasses } from './classes';

let fixture: ServiceFixture;

beforeAll(async () => {
  fixture = await createServiceFixture();
});

afterAll(async () => {
  await fixture.close();
});

const villaMorra = createLocationSchema.parse({ name: 'Villa Morra', city: 'Asunción' });

async function allowExtraLocations(boxId: string, extraLocations: number) {
  await fixture.system((transaction) =>
    transaction.update(boxes).set({ extraLocations }).where(eq(boxes.id, boxId)),
  );
}

describe('locations', () => {
  it('starts every box with one default location', async () => {
    const rows = await fixture.as(fixture.boxA, 'member', (context) => listLocations(context));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ isDefault: true, isActive: true });
  });

  it('only lets owners and admins create or edit locations', async () => {
    await allowExtraLocations(fixture.boxB.boxId, 5);
    for (const role of ['coach', 'reception', 'member'] as const) {
      await expectServiceError(
        fixture.as(fixture.boxB, role, (context) => createLocation(context, villaMorra)),
        'forbidden',
      );
    }
    const created = await fixture.as(fixture.boxB, 'box_admin', (context) =>
      createLocation(context, villaMorra),
    );
    expect(created).toMatchObject({ name: 'Villa Morra', isDefault: false, isActive: true });
    const [audit] = await fixture.system((transaction) =>
      transaction.select().from(auditLogs).where(eq(auditLogs.entityId, created.id)),
    );
    expect(audit?.action).toBe('location.created');
    await expectServiceError(
      fixture.as(fixture.boxB, 'box_owner', (context) => createLocation(context, villaMorra)),
      'location_name_taken',
    );
  });

  it('allows one location plus the extra ones GuaraniX bills for', async () => {
    await allowExtraLocations(fixture.boxA.boxId, 0);
    await expectServiceError(
      fixture.as(fixture.boxA, 'box_owner', (context) => createLocation(context, villaMorra)),
      'location_limit_reached',
    );
    await allowExtraLocations(fixture.boxA.boxId, 1);
    const second = await fixture.as(fixture.boxA, 'box_owner', (context) =>
      createLocation(context, villaMorra),
    );
    await expectServiceError(
      fixture.as(fixture.boxA, 'box_owner', (context) =>
        createLocation(context, { ...villaMorra, name: 'Lambaré' }),
      ),
      'location_limit_reached',
    );
    // A closed location frees its slot; reopening it needs one again.
    await fixture.as(fixture.boxA, 'box_owner', (context) =>
      updateLocation(context, second.id, { isActive: false }),
    );
    const third = await fixture.as(fixture.boxA, 'box_owner', (context) =>
      createLocation(context, { ...villaMorra, name: 'Lambaré' }),
    );
    await expectServiceError(
      fixture.as(fixture.boxA, 'box_owner', (context) =>
        updateLocation(context, second.id, { isActive: true }),
      ),
      'location_limit_reached',
    );
    const forMember = await fixture.as(fixture.boxA, 'member', (context) =>
      listLocations(context),
    );
    expect(forMember.map((location) => location.id)).not.toContain(second.id);
    expect(forMember.map((location) => location.id)).toContain(third.id);
  });

  it('keeps the default open and moves it on request', async () => {
    const [main, other] = await fixture.as(fixture.boxB, 'box_owner', async (context) => [
      await defaultLocation(context),
      await createLocation(context, { ...villaMorra, name: 'San Lorenzo' }),
    ]);
    await expectServiceError(
      fixture.as(fixture.boxB, 'box_owner', (context) =>
        updateLocation(context, main?.id ?? '', { isActive: false }),
      ),
      'default_location_required',
    );
    const moved = await fixture.as(fixture.boxB, 'box_owner', (context) =>
      updateLocation(context, other?.id ?? '', { isDefault: true }),
    );
    expect(moved.isDefault).toBe(true);
    const rows = await fixture.as(fixture.boxB, 'box_owner', (context) => listLocations(context));
    expect(rows.filter((location) => location.isDefault).map((location) => location.id)).toEqual([
      other?.id,
    ]);
    // Put it back so other tests see the original default.
    await fixture.as(fixture.boxB, 'box_owner', (context) =>
      updateLocation(context, main?.id ?? '', { isDefault: true }),
    );
  });

  it("hides another box's locations", async () => {
    const foreign = await fixture.as(fixture.boxB, 'box_owner', (context) =>
      defaultLocation(context),
    );
    await expectServiceError(
      fixture.as(fixture.boxA, 'box_owner', (context) =>
        updateLocation(context, foreign.id, { name: 'Robada' }),
      ),
      'location_not_found',
    );
    await expectServiceError(
      fixture.as(fixture.boxA, 'box_owner', (context) =>
        createPlan(context, {
          name: 'Plan ajeno',
          kind: 'unlimited',
          priceGs: 1,
          durationDays: 30,
          description: null,
          classesPerWeek: null,
          classCount: null,
          isActive: true,
          programIds: [],
          locationIds: [foreign.id],
        }),
      ),
      'location_not_found',
    );
  });
});

describe('schedules and classes by location', () => {
  it('puts schedules at the chosen location and their classes with them', async () => {
    await allowExtraLocations(fixture.boxB.boxId, 5);
    const world = bookingWorld(fixture, fixture.boxB);
    const location = await world.as('box_owner', (context) =>
      createLocation(context, { ...villaMorra, name: 'Luque' }),
    );
    const programId = await world.programId();
    const schedule = await world.as('box_owner', (context) =>
      createSchedule(
        context,
        classScheduleSchema.parse({
          programId,
          locationId: location.id,
          weekday: 1,
          startTime: '05:30',
          durationMinutes: 60,
          capacity: 12,
          validFrom: '2031-03-03',
        }),
      ),
    );
    expect(schedule.locationId).toBe(location.id);
    await world.as('box_owner', (context) =>
      createClassesFromSchedules(
        context.transaction,
        { id: fixture.boxB.boxId, timezone: 'America/Asuncion' },
        { from: '2031-03-03', days: 7 },
      ),
    );
    const generated = await fixture.system((transaction) =>
      transaction.select().from(classes).where(eq(classes.scheduleId, schedule.id)),
    );
    expect(generated.map((row) => row.locationId)).toEqual([location.id]);

    const atLuque = await world.as('member', (context) =>
      listClasses(context, { from: '2031-03-03', to: '2031-03-09', locationId: location.id }),
    );
    expect(atLuque.map((row) => row.id)).toEqual(generated.map((row) => row.id));

    await expectServiceError(
      world.as('box_owner', (context) =>
        updateLocation(context, location.id, { isActive: false }),
      ),
      'location_has_schedules',
    );
    await world.as('box_owner', (context) => endSchedule(context, schedule.id, '2031-03-03'));
    const closed = await world.as(
      'box_owner',
      (context) => updateLocation(context, location.id, { isActive: false }),
      new Date('2031-03-10T12:00:00Z'),
    );
    expect(closed.isActive).toBe(false);
    await expectServiceError(
      world.as('box_owner', (context) =>
        createSchedule(
          context,
          classScheduleSchema.parse({
            programId,
            locationId: location.id,
            weekday: 2,
            startTime: '05:30',
            durationMinutes: 60,
            capacity: 12,
            validFrom: '2031-03-03',
          }),
        ),
      ),
      'location_inactive',
    );
  });

  it('sends a schedule without a location to the default one', async () => {
    const world = bookingWorld(fixture, fixture.boxA);
    const programId = await world.programId();
    const schedule = await world.as('box_admin', (context) =>
      createSchedule(
        context,
        classScheduleSchema.parse({
          programId,
          weekday: 3,
          startTime: '21:00',
          durationMinutes: 60,
          capacity: 12,
          validFrom: '2031-03-03',
        }),
      ),
    );
    const main = await world.as('box_admin', (context) => defaultLocation(context));
    const [row] = await fixture.system((transaction) =>
      transaction.select().from(classSchedules).where(eq(classSchedules.id, schedule.id)),
    );
    expect(row?.locationId).toBe(main.id);
  });
});

describe('pass between locations', () => {
  it('lets a plan work everywhere unless it is limited to some locations', async () => {
    await allowExtraLocations(fixture.boxB.boxId, 10);
    const world = bookingWorld(fixture, fixture.boxB);
    await world.setPolicy({ bookingOpensHoursBefore: 168, bookingClosesMinutesBefore: 0 });
    const [main, other] = await world.as('box_owner', async (context) => [
      await defaultLocation(context),
      await createLocation(context, { ...villaMorra, name: 'Fernando de la Mora' }),
    ]);
    const atMain = await world.createClass({ startsAt: hoursFromNow(24), locationId: main?.id });
    const atOther = await world.createClass({ startsAt: hoursFromNow(26), locationId: other?.id });

    const everywhere = await world.createPlanOf({ kind: 'unlimited' });
    const traveller = await world.memberWith(everywhere);
    expect(
      (await traveller.act((context) => bookClass(context, { classId: atOther.id }))).status,
    ).toBe('booked');

    const mainOnly = await world.createPlanOf({ kind: 'unlimited', locationIds: [main?.id] });
    const plans = await world.as('reception', (context) => listPlans(context));
    expect(plans.find((plan) => plan.id === mainOnly.id)?.locationIds).toEqual([main?.id]);
    const local = await world.memberWith(mainOnly);
    await expectServiceError(
      local.act((context) => bookClass(context, { classId: atOther.id })),
      'plan_excludes_location',
    );
    expect((await local.act((context) => bookClass(context, { classId: atMain.id }))).status).toBe(
      'booked',
    );
  });
});
