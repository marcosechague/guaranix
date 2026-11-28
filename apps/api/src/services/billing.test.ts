import { eq } from 'drizzle-orm';
import { auditLogs, charges } from '@guaranix/db/schema';
import { recordPaymentSchema } from '@guaranix/shared/schemas';
import { addDays } from '@guaranix/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NOW, TODAY, bookingWorld, hoursFromNow } from '../testing/booking-helpers';
import { expectServiceError } from '../testing/expectations';
import { createServiceFixture, type ServiceFixture } from '../testing/service-fixture';
import { markAttendance } from './attendance';
import { bookClass } from './bookings';
import { createCharge, getCharge, listDebtors, ownAccount, voidCharge } from './charges';
import { dashboard } from './dashboard';
import { listPayments, recordPayment, reviewPayment } from './payments';

let fixture: ServiceFixture;
let world: ReturnType<typeof bookingWorld>;
let referenceCounter = 0;

beforeAll(async () => {
  fixture = await createServiceFixture();
  world = bookingWorld(fixture, fixture.boxA);
});

afterAll(async () => {
  await fixture.close();
});

const payment = (input: Record<string, unknown>) =>
  recordPaymentSchema.parse({ paidAt: NOW, method: 'cash', ...input });

async function memberOwing(amountGs: number, dueOn = addDays(TODAY, -3)) {
  const someone = await world.memberWith();
  const charge = await world.as('reception', (context) =>
    createCharge(context, {
      memberId: someone.member.id,
      memberPlanId: null,
      description: 'Cuota marzo',
      amountGs,
      dueOn,
      status: 'open',
    }),
  );
  return { ...someone, charge };
}

async function statusOf(chargeId: string) {
  return (await world.as('box_owner', (context) => getCharge(context, chargeId))).status;
}

describe('manual payments', () => {
  it('cash from reception is confirmed and settles the charge, also in parts', async () => {
    const { member, charge } = await memberOwing(300_000);
    const pay = (amountGs: number) =>
      world.as('reception', (context) =>
        recordPayment(context, payment({ memberId: member.id, chargeId: charge.id, amountGs })),
      );
    const first = await pay(100_000);
    expect(first).toMatchObject({
      status: 'confirmed',
      reviewedByUserId: fixture.boxA.userIds.reception,
    });
    expect(await statusOf(charge.id)).toBe('open');
    await pay(200_000);
    expect(await statusOf(charge.id)).toBe('paid');
  });

  it('never accepts more than what is owed', async () => {
    const { member, charge } = await memberOwing(150_000);
    await expectServiceError(
      world.as('reception', (context) =>
        recordPayment(
          context,
          payment({ memberId: member.id, chargeId: charge.id, amountGs: 150_001 }),
        ),
      ),
      'payment_exceeds_charge',
    );
  });

  it('a member reports a transfer with receipt; it counts only once confirmed', async () => {
    const owing = await memberOwing(280_000);
    referenceCounter += 1;
    const reported = await owing.act((context) =>
      recordPayment(
        context,
        payment({
          memberId: owing.member.id,
          chargeId: owing.charge.id,
          amountGs: 280_000,
          method: 'bank_transfer',
          reference: `OP-${referenceCounter}`,
          receiptFileKey: 'receipts/abc.jpg',
        }),
      ),
    );
    expect(reported.status).toBe('pending_review');
    expect(await statusOf(owing.charge.id)).toBe('open');
    const queue = await world.as('reception', (context) =>
      listPayments(context, { status: 'pending_review' }),
    );
    expect(queue.find((entry) => entry.id === reported.id)).toMatchObject({
      firstName: owing.member.firstName,
      lastName: owing.member.lastName,
    });
    expect((await owing.act((context) => ownAccount(context))).outstandingGs).toBe(280_000);

    await world.as('reception', (context) => reviewPayment(context, reported.id, 'confirmed'));
    expect(await statusOf(owing.charge.id)).toBe('paid');
    await expectServiceError(
      world.as('reception', (context) => reviewPayment(context, reported.id, 'rejected')),
      'payment_already_reviewed',
    );
  });

  it('refuses the same bank reference twice, but allows it again after a rejection', async () => {
    const owing = await memberOwing(100_000);
    const report = () =>
      owing.act((context) =>
        recordPayment(
          context,
          payment({
            memberId: owing.member.id,
            amountGs: 50_000,
            method: 'qr',
            reference: 'QR-777',
            receiptFileKey: 'receipts/qr.png',
          }),
        ),
      );
    const first = await report();
    await expectServiceError(report(), 'payment_duplicate');
    await world.as('reception', (context) => reviewPayment(context, first.id, 'rejected'));
    expect((await report()).status).toBe('pending_review');
  });

  it("members can't register cash, pay without a receipt or pay for someone else", async () => {
    const owing = await memberOwing(100_000);
    const other = await memberOwing(100_000);
    await expectServiceError(
      owing.act((context) =>
        recordPayment(context, payment({ memberId: owing.member.id, amountGs: 1 })),
      ),
      'cash_requires_staff',
    );
    await expectServiceError(
      owing.act((context) =>
        recordPayment(
          context,
          payment({ memberId: owing.member.id, amountGs: 1, method: 'bank_transfer' }),
        ),
      ),
      'receipt_required',
    );
    await expectServiceError(
      owing.act((context) =>
        recordPayment(
          context,
          payment({
            memberId: other.member.id,
            amountGs: 1,
            method: 'bank_transfer',
            receiptFileKey: 'r.jpg',
          }),
        ),
      ),
      'member_not_found',
    );
    await expectServiceError(
      owing.act((context) =>
        recordPayment(
          context,
          payment({
            memberId: owing.member.id,
            chargeId: other.charge.id,
            amountGs: 1,
            method: 'bank_transfer',
            receiptFileKey: 'r.jpg',
          }),
        ),
      ),
      'charge_not_found',
    );
  });

  it('coaches handle no money', async () => {
    const owing = await memberOwing(100_000);
    await expectServiceError(
      world.as('coach', (context) =>
        recordPayment(context, payment({ memberId: owing.member.id, amountGs: 1 })),
      ),
      'payment_requires_front_desk',
    );
    await expectServiceError(
      world.as('coach', (context) => listPayments(context, {})),
      'forbidden',
    );
    await expectServiceError(
      world.as('coach', (context) => listDebtors(context)),
      'forbidden',
    );
  });

  it('audits every payment', async () => {
    const owing = await memberOwing(90_000);
    const paid = await world.as('reception', (context) =>
      recordPayment(
        context,
        payment({ memberId: owing.member.id, chargeId: owing.charge.id, amountGs: 90_000 }),
      ),
    );
    const [entry] = await fixture.system((transaction) =>
      transaction.select().from(auditLogs).where(eq(auditLogs.entityId, paid.id)),
    );
    expect(entry).toMatchObject({
      action: 'payment.recorded',
      actorUserId: fixture.boxA.userIds.reception,
    });
  });
});

describe('charges and debtors', () => {
  it('lists members with overdue open charges, biggest debt first, net of partial payments', async () => {
    const big = await memberOwing(500_000, addDays(TODAY, -10));
    const small = await memberOwing(200_000, addDays(TODAY, -1));
    const notYet = await memberOwing(300_000, addDays(TODAY, 2));
    await world.as('reception', (context) =>
      recordPayment(
        context,
        payment({ memberId: big.member.id, chargeId: big.charge.id, amountGs: 100_000 }),
      ),
    );
    const debtors = await world.as('reception', (context) => listDebtors(context), NOW);
    const ids = debtors.map((debtor) => debtor.memberId);
    expect(ids.indexOf(big.member.id)).toBeLessThan(ids.indexOf(small.member.id));
    expect(ids).not.toContain(notYet.member.id);
    expect(debtors.find((debtor) => debtor.memberId === big.member.id)).toMatchObject({
      owedGs: 400_000,
      daysOverdue: 10,
      charges: 1,
    });
  });

  it('voids only open charges without confirmed money, managers only', async () => {
    const clean = await memberOwing(50_000);
    await expectServiceError(
      world.as('reception', (context) => voidCharge(context, clean.charge.id)),
      'forbidden',
    );
    expect(
      (await world.as('box_owner', (context) => voidCharge(context, clean.charge.id))).status,
    ).toBe('void');
    const paidPart = await memberOwing(50_000);
    await world.as('reception', (context) =>
      recordPayment(
        context,
        payment({ memberId: paidPart.member.id, chargeId: paidPart.charge.id, amountGs: 10_000 }),
      ),
    );
    await expectServiceError(
      world.as('box_owner', (context) => voidCharge(context, paidPart.charge.id)),
      'charge_has_payments',
    );
  });

  it("another box can't see, pay or void this box's charges", async () => {
    const owing = await memberOwing(70_000);
    const other = bookingWorld(fixture, fixture.boxB);
    await expectServiceError(
      other.as('box_owner', (context) => voidCharge(context, owing.charge.id)),
      'charge_not_found',
    );
    await expectServiceError(
      other.as('reception', (context) =>
        recordPayment(
          context,
          payment({ memberId: owing.member.id, chargeId: owing.charge.id, amountGs: 1 }),
        ),
      ),
      'member_not_found',
    );
    const foreignDebtors = await other.as('reception', (context) => listDebtors(context));
    expect(foreignDebtors.map((debtor) => debtor.memberId)).not.toContain(owing.member.id);
    const rows = await fixture.system((transaction) =>
      transaction.select().from(charges).where(eq(charges.id, owing.charge.id)),
    );
    expect(rows[0]?.status).toBe('open');
  });
});

describe('dashboard', () => {
  it('adds up collected money, pending receipts, debt, members and occupancy', async () => {
    const isolated = createServiceFixture();
    const local = await isolated;
    try {
      const box = bookingWorld(local, local.boxA);
      const range = { from: addDays(TODAY, -2), to: addDays(TODAY, 2) };
      // The seeded demo box already owes money; compare against it.
      const before = await box.as('box_owner', (context) => dashboard(context, range));
      const plan = await box.createPlanOf({ kind: 'unlimited', priceGs: 300_000 });
      const payer = await box.memberWith(plan);
      const debtor = await box.memberWith(plan, addDays(TODAY, -5));
      const [payerCharge] = await local.system((transaction) =>
        transaction
          .select()
          .from(charges)
          .where(eq(charges.memberPlanId, payer.memberPlan?.id ?? '')),
      );
      await box.as('reception', (context) =>
        recordPayment(
          context,
          payment({ memberId: payer.member.id, chargeId: payerCharge?.id, amountGs: 300_000 }),
        ),
      );
      await debtor.act((context) =>
        recordPayment(
          context,
          payment({
            memberId: debtor.member.id,
            amountGs: 50_000,
            method: 'qr',
            receiptFileKey: 'q.png',
          }),
        ),
      );
      const past = await box.createClass({ startsAt: hoursFromNow(-3), capacity: 4 });
      const booked = await box.as(
        'reception',
        (context) => bookClass(context, { classId: past.id, memberId: payer.member.id }),
        hoursFromNow(-4),
      );
      await box.as('coach', (context) =>
        markAttendance(context, past.id, [{ bookingId: booked.id, status: 'attended' }]),
      );

      const figures = await box.as('box_owner', (context) => dashboard(context, range));
      const delta = (key: keyof typeof figures.money) => figures.money[key] - before.money[key];
      expect(delta('collectedGs')).toBe(300_000);
      expect(delta('pendingReviewGs')).toBe(50_000);
      expect(delta('outstandingGs')).toBe(300_000);
      expect(delta('overdueGs')).toBe(300_000);
      expect(figures.members.activeMembers - before.members.activeMembers).toBe(2);
      expect(figures.classes).toEqual({ classes: 1, occupancyRate: 0.25, attended: 1 });
      await expectServiceError(
        box.as('reception', (context) => dashboard(context, { from: TODAY, to: TODAY })),
        'forbidden',
      );
    } finally {
      await local.close();
    }
  });
});
