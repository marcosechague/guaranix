import { eq } from 'drizzle-orm';
import { locations } from '@guaranix/db/schema';
import { addDays } from '@guaranix/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TODAY, bookingWorld, hoursFromNow } from '../testing/booking-helpers';
import { expectServiceError } from '../testing/expectations';
import { createServiceFixture, type ServiceFixture } from '../testing/service-fixture';
import { bookClass } from './bookings';
import { defaultLocation } from './locations';
import { checkInAtWall } from './wall-check-ins';
import { signWallCode, wallQrFor } from './wall-qr';

const SECRET = 'test-auth-secret';
const BOX = { latitude: -25.2867, longitude: -57.647 };
// About 60 m and 250 m south of the box.
const INSIDE = { latitude: -25.28724, longitude: -57.647 };
const ACROSS_TOWN = { latitude: -25.28895, longitude: -57.647 };

let fixture: ServiceFixture;
let world: ReturnType<typeof bookingWorld>;
let locationId: string;

beforeAll(async () => {
  fixture = await createServiceFixture();
  world = bookingWorld(fixture, fixture.boxA);
  const main = await world.as('box_owner', (context) => defaultLocation(context));
  locationId = main.id;
  await fixture.system((transaction) =>
    transaction.update(locations).set(BOX).where(eq(locations.id, locationId)),
  );
});

beforeEach(async () => {
  await world.setPolicy({
    bookingOpensHoursBefore: 168,
    checkInWallQrEnabled: true,
    checkInRadiusMeters: 150,
  });
});

afterAll(async () => {
  await fixture.close();
});

let day = 0;
function freshDay() {
  day += 1;
  const now = hoursFromNow(day * 24);
  return {
    now,
    today: addDays(TODAY, day),
    at: (hours: number) => new Date(now.getTime() + hours * 3_600_000),
  };
}

type Member = Awaited<ReturnType<typeof world.memberWith>>;

async function scanWall(member: Member, now: Date, where = INSIDE, accuracyMeters = 20) {
  const code = await signWallCode(SECRET, fixture.boxA.boxId, locationId);
  return member.act(
    (context) => checkInAtWall(context, SECRET, { code, ...where, accuracyMeters }),
    now,
  );
}

describe('wall QR check-in', () => {
  it('lets a booked member in from inside the box, once per class', async () => {
    const { now, today, at } = freshDay();
    const member = await world.memberWith(await world.createPlanOf({ kind: 'unlimited' }), today);
    const classRow = await world.createClass({ startsAt: at(0.2), locationId });
    await member.act((context) => bookClass(context, { classId: classRow.id }), now);

    expect(await scanWall(member, now)).toMatchObject({
      outcome: 'checked_in',
      class: { id: classRow.id },
    });
    expect(await scanWall(member, at(0.1))).toMatchObject({ outcome: 'already_checked_in' });
  });

  it('refuses a phone that is too far away or unsure where it is', async () => {
    const { now, today, at } = freshDay();
    const member = await world.memberWith(await world.createPlanOf({ kind: 'unlimited' }), today);
    const classRow = await world.createClass({ startsAt: at(0.2), locationId });
    await member.act((context) => bookClass(context, { classId: classRow.id }), now);
    await expectServiceError(scanWall(member, now, ACROSS_TOWN), 'wall_qr_too_far');
    await expectServiceError(scanWall(member, now, INSIDE, 400), 'wall_qr_inaccurate');
    // A wider radius in Ajustes lets the same spot in.
    await world.setPolicy({ checkInRadiusMeters: 300 });
    expect(await scanWall(member, now, ACROSS_TOWN)).toMatchObject({ outcome: 'checked_in' });
  });

  it('only counts during a class at that location, with the usual rules', async () => {
    const { now, today, at } = freshDay();
    const member = await world.memberWith(await world.createPlanOf({ kind: 'unlimited' }), today);
    await world.createClass({ startsAt: at(3), locationId });
    expect(await scanWall(member, now)).toMatchObject({
      outcome: 'denied',
      reason: 'no_class_now',
    });
    const planless = await world.memberWith(undefined, today);
    await world.createClass({ startsAt: at(0.2), locationId });
    expect(await scanWall(planless, now)).toMatchObject({
      outcome: 'denied',
      reason: 'no_valid_plan',
    });
  });

  it("rejects another box's poster, a made-up code, and works only when the box turned it on", async () => {
    const { now, today } = freshDay();
    const member = await world.memberWith(await world.createPlanOf({ kind: 'unlimited' }), today);
    const foreign = await signWallCode(SECRET, fixture.boxB.boxId, locationId);
    const attempt = (code: string) =>
      member.act(
        (context) => checkInAtWall(context, SECRET, { code, ...INSIDE, accuracyMeters: 10 }),
        now,
      );
    await expectServiceError(attempt(foreign), 'wall_qr_invalid');
    await expectServiceError(attempt(`w1.${locationId}.forged`), 'wall_qr_invalid');
    await world.setPolicy({ checkInWallQrEnabled: false });
    await expectServiceError(scanWall(member, now), 'check_in_mode_disabled');
  });

  it('is for members only', async () => {
    const code = await signWallCode(SECRET, fixture.boxA.boxId, locationId);
    await expectServiceError(
      world.as('coach', (context) =>
        checkInAtWall(context, SECRET, { code, ...INSIDE, accuracyMeters: 10 }),
      ),
      'forbidden',
    );
  });
});

describe('the poster', () => {
  it('opens the member app with a code for that location, for managers only', async () => {
    const poster = await world.as('box_admin', (context) =>
      wallQrFor(context, SECRET, 'https://guaranix.example.dev', locationId),
    );
    const code = await signWallCode(SECRET, fixture.boxA.boxId, locationId);
    expect(poster.url).toBe(`https://guaranix.example.dev/pared/${code}`);
    await expectServiceError(
      world.as('coach', (context) => wallQrFor(context, SECRET, 'https://x.dev', locationId)),
      'forbidden',
    );
  });
});
