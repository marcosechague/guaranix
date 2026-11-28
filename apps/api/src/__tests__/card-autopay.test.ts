import { withBoxScope } from '@guaranix/db';
import {
  charges,
  memberPlans,
  notifications,
  paymentAccounts,
  paymentAttempts,
  paymentEvents,
  payments,
  plans,
} from '@guaranix/db/schema';
import { MOCK_SIGNATURE_HEADER, PaymentProviderError, signMockWebhook } from '@guaranix/payments';
import { addDays } from '@guaranix/shared';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runCardAutopay } from '../jobs/card-autopay';
import { nextRetryOn } from '../services/card-attempts';
import {
  enableCardPayments,
  MOCK_ACCOUNT,
  openCharge,
  runtimeOf,
  systemRows,
  today,
  userIn,
} from './card-payments-helpers';
import { createHarness, type Harness, testEnv } from './harness';

let harness: Harness;
let owner: Awaited<ReturnType<typeof userIn>>;
let accountId: string;

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY);
const run = (now = new Date()) =>
  runCardAutopay(
    harness.database,
    runtimeOf(harness),
    { queue: harness.notificationQueue, notifier: harness.payments.notifier },
    now,
  );

beforeAll(async () => {
  harness = await createHarness();
  owner = await userIn(harness, 'box_owner');
  await enableCardPayments(harness, harness.boxA.boxId);
  await owner.browser.put('/box/card-payments/account', MOCK_ACCOUNT);
  const [account] = await systemRows(harness, (transaction) =>
    transaction.select().from(paymentAccounts).where(eq(paymentAccounts.boxId, harness.boxA.boxId)),
  );
  accountId = account?.id ?? '';
}, 60_000);

afterAll(async () => {
  await harness.close();
});

beforeEach(() => {
  harness.payments.behaviour = {};
  harness.payments.notifier.sent.length = 0;
});

/** A member with an active card on the box's account. */
async function payingMember() {
  const member = await userIn(harness, 'member');
  const { card } = (await (
    await member.browser.post('/box/card-payments/me/cards', { acceptAutopay: true })
  ).json()) as { card: { id: string } };
  await member.browser.post(`/box/card-payments/me/cards/${card.id}/confirm`);
  return member;
}

const attemptsOf = (chargeId: string) =>
  systemRows(harness, (transaction) =>
    transaction
      .select()
      .from(paymentAttempts)
      .where(eq(paymentAttempts.chargeId, chargeId))
      .orderBy(paymentAttempts.attemptNumber),
  );

const statusOf = async (chargeId: string) =>
  (
    await systemRows(harness, (transaction) =>
      transaction.select().from(charges).where(eq(charges.id, chargeId)),
    )
  )[0]?.status;

const paymentsOf = (chargeId: string) =>
  systemRows(harness, (transaction) =>
    transaction.select().from(payments).where(eq(payments.chargeId, chargeId)),
  );

describe('card autopay', () => {
  it('charges what is due, records one confirmed card payment and settles the charge', async () => {
    const member = await payingMember();
    const charge = await openCharge(harness, member.memberId, 300_000);
    const result = await run();
    expect(result).toMatchObject({ approved: 1, declined: 0, failedBoxIds: [] });
    expect(await statusOf(charge.id)).toBe('paid');
    const recorded = await paymentsOf(charge.id);
    expect(recorded).toEqual([
      expect.objectContaining({ amountGs: 300_000, method: 'card', status: 'confirmed' }),
    ]);

    // Running the job again (Cloudflare retries, or a manual rerun) charges nothing.
    await run();
    expect(await attemptsOf(charge.id)).toHaveLength(1);
    expect(await paymentsOf(charge.id)).toHaveLength(1);
  });

  it('charges only what is still owed after a partial payment at the desk', async () => {
    const member = await payingMember();
    const charge = await openCharge(harness, member.memberId, 300_000);
    await withBoxScope(harness.database, { boxId: harness.boxA.boxId }, (transaction) =>
      transaction.insert(payments).values({
        boxId: harness.boxA.boxId,
        memberId: member.memberId,
        chargeId: charge.id,
        amountGs: 100_000,
        method: 'cash',
        status: 'confirmed',
        paidAt: new Date(),
        reviewedAt: new Date(),
      }),
    );
    await run();
    const [attempt] = await attemptsOf(charge.id);
    expect(attempt?.amountGs).toBe(200_000);
    expect(await statusOf(charge.id)).toBe('paid');
  });

  it('leaves alone members without a card, future charges and debts from before the consent', async () => {
    const withoutCard = await userIn(harness, 'member');
    const noCard = await openCharge(harness, withoutCard.memberId, 300_000);
    const member = await payingMember();
    const future = await openCharge(harness, member.memberId, 300_000, addDays(today(), 3));
    const old = await openCharge(harness, member.memberId, 300_000, addDays(today(), -10));
    await run();
    for (const charge of [noCard, future, old]) expect(await attemptsOf(charge.id)).toEqual([]);
  });

  it('retries a decline 1, 3 and 7 days later, then stops; it sends the link on the first and last', async () => {
    const member = await payingMember();
    const charge = await openCharge(harness, member.memberId, 300_013);

    await run();
    let attempts = await attemptsOf(charge.id);
    expect(attempts).toEqual([
      expect.objectContaining({
        status: 'declined',
        declineCode: '51',
        nextRetryOn: nextRetryOn(today(), 1),
      }),
    ]);
    expect(harness.payments.notifier.sent).toEqual([
      expect.objectContaining({
        chargeId: charge.id,
        amountGs: 300_013,
        attemptNumber: 1,
        finalAttempt: false,
        linkUrl: expect.stringMatching(/\/pagar\/[\w-]{43}$/),
        whatsappUrl: expect.stringMatching(/^https:\/\/wa\.me\/595981123456/),
      }),
    ]);

    // Same day again: not due yet.
    await run();
    expect(await attemptsOf(charge.id)).toHaveLength(1);

    for (const day of [1, 3, 7]) await run(inDays(day));
    attempts = await attemptsOf(charge.id);
    expect(attempts.map((attempt) => attempt.attemptNumber)).toEqual([1, 2, 3, 4]);
    expect(attempts.at(-1)?.nextRetryOn).toBeNull();
    expect(harness.payments.notifier.sent.map((notice) => notice.attemptNumber)).toEqual([1, 4]);
    expect(harness.payments.notifier.sent.at(-1)?.finalAttempt).toBe(true);
    // The member hears it by push too, through the outbox, without the secret link.
    const pushes = await systemRows(harness, (transaction) =>
      transaction
        .select()
        .from(notifications)
        .where(eq(notifications.kind, 'card_payment_failed')),
    );
    const forCharge = pushes.filter((row) => row.idempotencyKey.includes(charge.id));
    expect(forCharge.map((row) => row.params)).toEqual([
      expect.objectContaining({ amount: '₲ 300.013', finalAttempt: null }),
      expect.objectContaining({ finalAttempt: 1 }),
    ]);
    expect(JSON.stringify(forCharge)).not.toContain('/pagar/');

    await run(inDays(20));
    expect(await attemptsOf(charge.id)).toHaveLength(4);
    expect(await statusOf(charge.id)).toBe('open');
  });

  it('keeps an unanswered charge pending and settles it from the processor on the next run', async () => {
    const member = await payingMember();
    const charge = await openCharge(harness, member.memberId, 120_000);
    harness.payments.behaviour = {
      charge: () => {
        throw new PaymentProviderError('unavailable');
      },
    };
    const first = await run();
    expect(first.unanswered).toBe(1);
    const [pending] = await attemptsOf(charge.id);
    expect(pending?.status).toBe('pending');

    // The processor did take the money; a new run asks before trying again.
    harness.payments.behaviour = {
      statuses: new Map([
        [
          pending?.orderNumber ?? 0,
          {
            status: 'approved',
            amountGs: 120_000,
            authorizationCode: 'A1',
            providerReference: 'T1',
          },
        ],
      ]),
      charge: () => {
        throw new Error('must not charge again');
      },
    };
    await run(new Date(Date.now() + 15 * 60 * 1000));
    expect(await attemptsOf(charge.id)).toEqual([expect.objectContaining({ status: 'approved' })]);
    expect(await statusOf(charge.id)).toBe('paid');
  });

  it('renews a monthly plan for a member paying by card and charges its first day', async () => {
    const member = await payingMember();
    const [plan] = await systemRows(harness, (transaction) =>
      transaction
        .select()
        .from(plans)
        .where(
          and(
            eq(plans.boxId, harness.boxA.boxId),
            eq(plans.kind, 'unlimited'),
            eq(plans.isActive, true),
          ),
        )
        .limit(1),
    );
    if (!plan) throw new Error('demo box has no unlimited plan');
    const endsOn = addDays(today(), 1);
    const [current] = await withBoxScope(
      harness.database,
      { boxId: harness.boxA.boxId },
      (transaction) =>
        transaction
          .insert(memberPlans)
          .values({
            boxId: harness.boxA.boxId,
            memberId: member.memberId,
            planId: plan.id,
            startsOn: addDays(endsOn, -(plan.durationDays - 1)),
            endsOn,
            priceGs: plan.priceGs,
          })
          .returning(),
    );
    const result = await run();
    expect(result.renewed).toBeGreaterThanOrEqual(1);
    const renewals = await systemRows(harness, (transaction) =>
      transaction
        .select()
        .from(memberPlans)
        .where(eq(memberPlans.renewedFromId, current?.id ?? '')),
    );
    expect(renewals).toEqual([
      expect.objectContaining({ startsOn: addDays(endsOn, 1), priceGs: plan.priceGs }),
    ]);
    const due = await systemRows(harness, (transaction) =>
      transaction
        .select()
        .from(charges)
        .where(eq(charges.memberPlanId, renewals[0]?.id ?? '')),
    );
    expect(due).toEqual([expect.objectContaining({ dueOn: addDays(endsOn, 1), status: 'open' })]);

    // The next day the new period is due and gets charged; nothing renews twice.
    await run(inDays(2));
    expect(await statusOf(due[0]?.id ?? '')).toBe('paid');
    const again = await systemRows(harness, (transaction) =>
      transaction
        .select()
        .from(memberPlans)
        .where(eq(memberPlans.renewedFromId, current?.id ?? '')),
    );
    expect(again).toHaveLength(1);
  });
});

describe('processor webhook', () => {
  async function pendingLinkAttempt() {
    const member = await userIn(harness, 'member');
    const charge = await openCharge(harness, member.memberId, 90_000);
    const [attempt] = await withBoxScope(
      harness.database,
      { boxId: harness.boxA.boxId },
      (transaction) =>
        transaction
          .insert(paymentAttempts)
          .values({
            boxId: harness.boxA.boxId,
            accountId,
            chargeId: charge.id,
            memberId: member.memberId,
            kind: 'link',
            amountGs: 90_000,
          })
          .returning(),
    );
    if (!attempt) throw new Error('attempt not created');
    return { charge, attempt };
  }

  const send = (body: string, signature: string, account = accountId) =>
    harness.app.request(
      `/webhooks/payments/${account}`,
      { method: 'POST', body, headers: { [MOCK_SIGNATURE_HEADER]: signature } },
      testEnv,
    );

  it('applies a signed confirmation once, however many times it arrives', async () => {
    const { charge, attempt } = await pendingLinkAttempt();
    const signed = await signMockWebhook(MOCK_ACCOUNT.privateKey, {
      orderNumber: attempt.orderNumber,
      approved: true,
      amountGs: 90_000,
    });
    // No Origin and no session: a server calls this.
    const responses = await Promise.all([
      send(signed.body, signed.signature),
      send(signed.body, signed.signature),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(await responses[0]?.json()).toEqual({ status: 'success' });
    expect(await paymentsOf(charge.id)).toHaveLength(1);
    expect(await statusOf(charge.id)).toBe('paid');
    const events = await systemRows(harness, (transaction) =>
      transaction
        .select()
        .from(paymentEvents)
        .where(eq(paymentEvents.orderNumber, attempt.orderNumber)),
    );
    expect(events.map((event) => event.outcome).sort()).toEqual(['duplicate', 'processed']);
  });

  it('rejects and logs a confirmation signed with any other key', async () => {
    const { charge, attempt } = await pendingLinkAttempt();
    const forged = await signMockWebhook('someone-else', {
      orderNumber: attempt.orderNumber,
      approved: true,
      amountGs: 90_000,
    });
    const response = await send(forged.body, forged.signature);
    expect(response.status).toBe(401);
    expect(await paymentsOf(charge.id)).toEqual([]);
    const rejected = await systemRows(harness, (transaction) =>
      transaction
        .select()
        .from(paymentEvents)
        .where(
          and(eq(paymentEvents.accountId, accountId), eq(paymentEvents.signatureValid, false)),
        ),
    );
    expect(rejected.length).toBeGreaterThanOrEqual(1);
  });

  it('answers 404 for accounts that do not exist', async () => {
    expect((await send('{}', 'x', crypto.randomUUID())).status).toBe(404);
    expect((await send('{}', 'x', 'not-a-uuid')).status).toBe(404);
  });
});

describe('card refunds', () => {
  it('managers refund a card payment; the charge is owed again', async () => {
    const member = await payingMember();
    const charge = await openCharge(harness, member.memberId, 210_000);
    await run();
    const [payment] = await paymentsOf(charge.id);
    const reception = await userIn(harness, 'reception');
    expect(
      (await reception.browser.post(`/box/card-payments/payments/${payment?.id}/refund`)).status,
    ).toBe(403);
    const refunded = await owner.browser.post(`/box/card-payments/payments/${payment?.id}/refund`);
    expect(await refunded.json()).toMatchObject({ payment: { status: 'refunded' } });
    expect(await statusOf(charge.id)).toBe('open');
    const twice = await owner.browser.post(`/box/card-payments/payments/${payment?.id}/refund`);
    expect(await twice.json()).toEqual({ error: 'payment_not_refundable' });
  });

  it('says when the processor no longer allows the refund, and changes nothing', async () => {
    const member = await payingMember();
    const charge = await openCharge(harness, member.memberId, 95_000);
    await run();
    const [payment] = await paymentsOf(charge.id);
    harness.payments.behaviour = { refundFails: true };
    const refused = await owner.browser.post(`/box/card-payments/payments/${payment?.id}/refund`);
    expect(await refused.json()).toEqual({ error: 'refund_not_available' });
    expect(await statusOf(charge.id)).toBe('paid');
  });

  it('another box sees none of the attempts', async () => {
    const other = await userIn(harness, 'box_owner', harness.boxB.boxId);
    const listed = await other.browser.get('/box/card-payments/attempts');
    expect(await listed.json()).toEqual({ attempts: [] });
    const mine = await owner.browser.get('/box/card-payments/attempts');
    expect(((await mine.json()) as { attempts: unknown[] }).attempts.length).toBeGreaterThan(0);
  });
});
