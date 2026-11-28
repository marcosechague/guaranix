import { eq } from 'drizzle-orm';
import { boxUsers } from '@guaranix/db/schema';
import { calendarDateIn } from '@guaranix/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { bookingWorld } from '../testing/booking-helpers';
import { expectServiceError } from '../testing/expectations';
import { createServiceFixture, type ServiceFixture } from '../testing/service-fixture';
import { checkInWithPass, issueOwnCheckInPass } from './check-ins';
import { issueOwnStaffPass, listStaffArrivals, recordStaffArrival } from './staff-arrivals';

const SECRET = 'test-auth-secret';
const NOW = new Date('2031-05-05T11:00:00Z');
const TODAY = calendarDateIn('America/Asuncion', NOW);

let fixture: ServiceFixture;
let world: ReturnType<typeof bookingWorld>;
let otherWorld: ReturnType<typeof bookingWorld>;

beforeAll(async () => {
  fixture = await createServiceFixture();
  world = bookingWorld(fixture, fixture.boxA);
  otherWorld = bookingWorld(fixture, fixture.boxB);
});

beforeEach(async () => {
  await world.setPolicy({ checkInDeskEnabled: true, checkInStaffEnabled: true });
  await otherWorld.setPolicy({ checkInDeskEnabled: true, checkInStaffEnabled: true });
});

afterAll(async () => {
  await fixture.close();
});

async function coachPass(now = NOW) {
  const { pass } = await world.as('coach', (context) => issueOwnStaffPass(context, SECRET), now);
  return pass;
}

function scan(pass: string, now = NOW) {
  return world.as('reception', (context) => checkInWithPass(context, SECRET, pass), now);
}

describe('staff arrivals', () => {
  it('records the first scan of the day and keeps its time on later scans', async () => {
    const first = await scan(await coachPass());
    expect(first).toMatchObject({
      outcome: 'staff_arrived',
      member: { id: fixture.boxA.userIds.coach },
      arrivedAt: NOW.toISOString(),
    });
    const later = new Date(NOW.getTime() + 2 * 3_600_000);
    const second = await scan(await coachPass(later), later);
    expect(second).toMatchObject({ outcome: 'staff_arrived', arrivedAt: NOW.toISOString() });

    const arrivals = await world.as('box_owner', (context) => listStaffArrivals(context, TODAY));
    expect(arrivals).toEqual([
      {
        userId: fixture.boxA.userIds.coach,
        fullName: expect.any(String),
        arrivedAt: NOW.toISOString(),
      },
    ]);
  });

  it('only shows arrivals to owners and admins', async () => {
    for (const role of ['coach', 'reception', 'member'] as const) {
      await expectServiceError(
        world.as(role, (context) => listStaffArrivals(context, TODAY)),
        'forbidden',
      );
    }
  });

  it('gives no staff pass to members, nor anyone while the mode is off', async () => {
    await expectServiceError(
      world.as('member', (context) => issueOwnStaffPass(context, SECRET)),
      'forbidden',
    );
    const pass = await coachPass();
    await world.setPolicy({ checkInStaffEnabled: false });
    await expectServiceError(
      world.as('coach', (context) => issueOwnStaffPass(context, SECRET)),
      'check_in_mode_disabled',
    );
    await expectServiceError(scan(pass), 'check_in_mode_disabled');
  });

  it("rejects another box's staff pass", async () => {
    const { pass } = await otherWorld.as('coach', (context) => issueOwnStaffPass(context, SECRET));
    await expectServiceError(scan(pass), 'check_in_pass_invalid');
  });

  it('does not let a member pass count as staff, nor a staff pass as a member', async () => {
    const { pass: memberPass } = await world.as('member', (context) =>
      issueOwnCheckInPass(context, SECRET),
    );
    await expectServiceError(
      world.as('reception', (context) => recordStaffArrival(context, SECRET, memberPass)),
      'check_in_pass_invalid',
    );
    const result = await scan(await coachPass());
    expect(result.outcome).toBe('staff_arrived');
  });

  it('turns away someone who no longer works at the box', async () => {
    const pass = await coachPass();
    await fixture.system((transaction) =>
      transaction
        .update(boxUsers)
        .set({ isActive: false })
        .where(eq(boxUsers.userId, fixture.boxA.userIds.coach)),
    );
    try {
      await expectServiceError(scan(pass), 'staff_inactive');
    } finally {
      await fixture.system((transaction) =>
        transaction
          .update(boxUsers)
          .set({ isActive: true })
          .where(eq(boxUsers.userId, fixture.boxA.userIds.coach)),
      );
    }
  });
});
