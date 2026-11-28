import { and, eq } from 'drizzle-orm';
import { auditLogs, boxes } from '@guaranix/db/schema';
import type { BookingPolicy, CheckInPolicy } from '@guaranix/shared/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { expectServiceError } from '../testing/expectations';
import { createServiceFixture, type ServiceFixture } from '../testing/service-fixture';
import {
  assertCheckInModeEnabled,
  getBookingPolicy,
  getCheckInPolicy,
  updateBookingPolicy,
  updateCheckInPolicy,
} from './box-settings';

let fixture: ServiceFixture;

beforeAll(async () => {
  fixture = await createServiceFixture();
});

afterAll(async () => {
  await fixture.close();
});

const policy: BookingPolicy = {
  bookingOpensHoursBefore: 36,
  bookingClosesMinutesBefore: 30,
  lateCancelMinutesBefore: 180,
  lateCancelConsumesCredit: true,
  noShowConsumesCredit: false,
  waitlistAutoPromote: true,
};

describe('booking policy settings', () => {
  it('only lets owners and admins change it', async () => {
    for (const role of ['coach', 'reception', 'member'] as const) {
      await expectServiceError(
        fixture.as(fixture.boxA, role, (context) => updateBookingPolicy(context, policy)),
        'forbidden',
      );
    }
    await expectServiceError(
      fixture.as(fixture.boxA, 'member', (context) => getBookingPolicy(context)),
      'forbidden',
    );
  });

  it('saves the policy for the session box only and audits what changed', async () => {
    const before = await fixture.as(fixture.boxB, 'box_owner', (context) =>
      getBookingPolicy(context),
    );
    const saved = await fixture.as(fixture.boxA, 'box_admin', (context) =>
      updateBookingPolicy(context, policy),
    );
    expect(saved).toEqual(policy);
    expect(
      await fixture.as(fixture.boxA, 'reception', (context) => getBookingPolicy(context)),
    ).toEqual(policy);
    expect(
      await fixture.as(fixture.boxB, 'box_owner', (context) => getBookingPolicy(context)),
    ).toEqual(before);

    const [entry] = await fixture.system((transaction) =>
      transaction
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.boxId, fixture.boxA.boxId),
            eq(auditLogs.action, 'box.booking_policy_updated'),
          ),
        ),
    );
    expect(entry?.actorUserId).toBe(fixture.boxA.userIds.box_admin);
    expect(entry?.changes).toMatchObject({ bookingOpensHoursBefore: { to: 36 } });
    const [row] = await fixture.system((transaction) =>
      transaction.select().from(boxes).where(eq(boxes.id, fixture.boxB.boxId)),
    );
    expect(row?.bookingOpensHoursBefore).toBe(before.bookingOpensHoursBefore);
  });
});

describe('check-in settings', () => {
  const checkIn: CheckInPolicy = {
    checkInDeskEnabled: false,
    checkInCoachEnabled: false,
    checkInWallQrEnabled: true,
    checkInRadiusMeters: 200,
  };

  it('starts with only the coach list on', async () => {
    expect(await fixture.as(fixture.boxB, 'coach', (context) => getCheckInPolicy(context))).toEqual(
      {
        checkInDeskEnabled: false,
        checkInCoachEnabled: true,
        checkInWallQrEnabled: false,
        checkInRadiusMeters: 150,
      },
    );
  });

  it('only owners and admins change it, for their box only, audited', async () => {
    for (const role of ['coach', 'reception', 'member'] as const) {
      await expectServiceError(
        fixture.as(fixture.boxA, role, (context) => updateCheckInPolicy(context, checkIn)),
        'forbidden',
      );
    }
    const saved = await fixture.as(fixture.boxA, 'box_owner', (context) =>
      updateCheckInPolicy(context, checkIn),
    );
    expect(saved).toEqual(checkIn);
    await expectServiceError(
      fixture.as(fixture.boxA, 'member', (context) => assertCheckInModeEnabled(context, 'coach')),
      'check_in_mode_disabled',
    );
    await fixture.as(fixture.boxB, 'member', (context) =>
      assertCheckInModeEnabled(context, 'coach'),
    );
    const [entry] = await fixture.system((transaction) =>
      transaction
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.boxId, fixture.boxA.boxId),
            eq(auditLogs.action, 'box.check_in_policy_updated'),
          ),
        ),
    );
    expect(entry?.changes).toMatchObject({ checkInCoachEnabled: { to: false } });
  });
});
