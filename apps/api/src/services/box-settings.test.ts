import { and, eq } from 'drizzle-orm';
import { auditLogs, boxes } from '@guaranix/db/schema';
import type { BookingPolicy } from '@guaranix/shared/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { expectServiceError } from '../testing/expectations';
import { createServiceFixture, type ServiceFixture } from '../testing/service-fixture';
import { getBookingPolicy, updateBookingPolicy } from './box-settings';

let fixture: ServiceFixture;

beforeAll(async () => {
  fixture = await createServiceFixture();
});

afterAll(async () => {
  await fixture.close();
});

const policy: BookingPolicy = {
  bookingOpensHoursBefore: 24,
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
    expect(entry?.changes).toMatchObject({ bookingOpensHoursBefore: { to: 24 } });
    const [row] = await fixture.system((transaction) =>
      transaction.select().from(boxes).where(eq(boxes.id, fixture.boxB.boxId)),
    );
    expect(row?.bookingOpensHoursBefore).toBe(before.bookingOpensHoursBefore);
  });
});
