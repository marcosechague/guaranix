import { withBoxScope } from '@guaranix/db';
import {
  auditLogs,
  charges,
  paymentAccounts,
  paymentAttempts,
  payments,
} from '@guaranix/db/schema';
import { MOCK_SIGNATURE_HEADER, PaymentProviderError, signMockWebhook } from '@guaranix/payments';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runCardAutopay } from '../jobs/card-autopay';
import {
  enableCardPayments,
  MOCK_ACCOUNT,
  openCharge,
  runtimeOf,
  systemRows,
  userIn,
} from './card-payments-helpers';
import { APP_ORIGIN, createHarness, type Harness, testEnv } from './harness';

let harness: Harness;
let accountA: string;
let accountB: string;

const accountOf = async (boxId: string) =>
  (
    await systemRows(harness, (transaction) =>
      transaction.select().from(paymentAccounts).where(eq(paymentAccounts.boxId, boxId)),
    )
  )[0]?.id ?? '';

beforeAll(async () => {
  harness = await createHarness();
  for (const boxId of [harness.boxA.boxId, harness.boxB.boxId]) {
    await enableCardPayments(harness, boxId);
    const owner = await userIn(harness, 'box_owner', boxId);
    await owner.browser.put('/box/card-payments/account', MOCK_ACCOUNT);
  }
  accountA = await accountOf(harness.boxA.boxId);
  accountB = await accountOf(harness.boxB.boxId);
}, 60_000);

afterAll(async () => {
  await harness.close();
});

beforeEach(() => {
  harness.payments.behaviour = {};
});

const publicPost = (path: string) =>
  harness.app.request(path, { method: 'POST', headers: { origin: APP_ORIGIN } }, testEnv);

async function linkFor(chargeId: string) {
  const reception = await userIn(harness, 'reception');
  const { link } = (await (
    await reception.browser.post('/box/card-payments/links', { chargeId })
  ).json()) as { link: { url: string } };
  return link.url.split('/').at(-1) ?? '';
}

const attemptsOf = (chargeId: string) =>
  systemRows(harness, (transaction) =>
    transaction.select().from(paymentAttempts).where(eq(paymentAttempts.chargeId, chargeId)),
  );

const webhook = async (account: string, orderNumber: number, amountGs: number) => {
  const signed = await signMockWebhook(MOCK_ACCOUNT.privateKey, {
    orderNumber,
    approved: true,
    amountGs,
  });
  return harness.app.request(
    `/webhooks/payments/${account}`,
    { method: 'POST', body: signed.body, headers: { [MOCK_SIGNATURE_HEADER]: signed.signature } },
    testEnv,
  );
};

describe('one payment in flight per charge', () => {
  it('a second tab or a double tap reopens the same form instead of a second order', async () => {
    const member = await userIn(harness, 'member');
    const charge = await openCharge(harness, member.memberId, 200_000);
    const token = await linkFor(charge.id);
    const first = await publicPost(`/pay/${token}/checkout`);
    const second = await publicPost(`/pay/${token}/checkout`);
    const [a, b] = (await Promise.all([first.json(), second.json()])) as {
      checkout: { processId: string };
    }[];
    expect(a?.checkout.processId).toBe(b?.checkout.processId);
    expect(await attemptsOf(charge.id)).toHaveLength(1);
  });

  it('refuses the link while an automatic charge has no answer yet', async () => {
    const member = await userIn(harness, 'member');
    const { card } = (await (
      await member.browser.post('/box/card-payments/me/cards', { acceptAutopay: true })
    ).json()) as { card: { id: string } };
    await member.browser.post(`/box/card-payments/me/cards/${card.id}/confirm`);
    const charge = await openCharge(harness, member.memberId, 150_000);
    harness.payments.behaviour = {
      charge: () => {
        throw new PaymentProviderError('unavailable');
      },
    };
    await runCardAutopay(
      harness.database,
      runtimeOf(harness),
      { queue: harness.notificationQueue, notifier: harness.payments.notifier },
      new Date(),
    );
    const token = await linkFor(charge.id);
    const refused = await publicPost(`/pay/${token}/checkout`);
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: 'payment_in_progress' });
    expect(await attemptsOf(charge.id)).toEqual([expect.objectContaining({ kind: 'autopay' })]);
  });

  it('does not charge the saved card while the member is on the link form', async () => {
    const member = await userIn(harness, 'member');
    const { card } = (await (
      await member.browser.post('/box/card-payments/me/cards', { acceptAutopay: true })
    ).json()) as { card: { id: string } };
    await member.browser.post(`/box/card-payments/me/cards/${card.id}/confirm`);
    const charge = await openCharge(harness, member.memberId, 110_000);
    const token = await linkFor(charge.id);
    await publicPost(`/pay/${token}/checkout`);
    harness.payments.behaviour = {
      charge: () => {
        throw new Error('must not charge while the link form is open');
      },
    };
    await runCardAutopay(
      harness.database,
      runtimeOf(harness),
      { queue: harness.notificationQueue, notifier: harness.payments.notifier },
      new Date(),
    );
    expect(await attemptsOf(charge.id)).toEqual([expect.objectContaining({ kind: 'link' })]);
  });
});

describe('an approval for a charge that was already paid', () => {
  async function paidElsewhere() {
    const member = await userIn(harness, 'member');
    const charge = await openCharge(harness, member.memberId, 90_000);
    const token = await linkFor(charge.id);
    await publicPost(`/pay/${token}/checkout`);
    const [attempt] = await attemptsOf(charge.id);
    await withBoxScope(harness.database, { boxId: harness.boxA.boxId }, (transaction) =>
      transaction.update(charges).set({ status: 'paid' }).where(eq(charges.id, charge.id)),
    );
    return { charge, orderNumber: attempt?.orderNumber ?? 0 };
  }

  const auditOf = (action: string) =>
    systemRows(harness, (transaction) =>
      transaction
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.boxId, harness.boxA.boxId), eq(auditLogs.action, action))),
    );

  it('is given back to the member right away', async () => {
    const { charge, orderNumber } = await paidElsewhere();
    expect((await webhook(accountA, orderNumber, 90_000)).status).toBe(200);
    const recorded = await systemRows(harness, (transaction) =>
      transaction.select().from(payments).where(eq(payments.chargeId, charge.id)),
    );
    expect(recorded).toEqual([expect.objectContaining({ method: 'card', status: 'refunded' })]);
    expect(await attemptsOf(charge.id)).toEqual([expect.objectContaining({ status: 'refunded' })]);
    expect(await auditOf('payment.card_duplicate_refunded')).not.toHaveLength(0);
  });

  it('is flagged for staff when the processor no longer allows the refund', async () => {
    const { charge, orderNumber } = await paidElsewhere();
    harness.payments.behaviour = { refundFails: true };
    await webhook(accountA, orderNumber, 90_000);
    const recorded = await systemRows(harness, (transaction) =>
      transaction.select().from(payments).where(eq(payments.chargeId, charge.id)),
    );
    expect(recorded).toEqual([expect.objectContaining({ status: 'confirmed' })]);
    expect(await auditOf('payment.card_duplicate_needs_refund')).not.toHaveLength(0);
  });
});

describe('isolation and roles', () => {
  it("a box's confirmation can't touch another box's order", async () => {
    const member = await userIn(harness, 'member', harness.boxB.boxId);
    const charge = await openCharge(
      harness,
      member.memberId,
      70_000,
      undefined,
      harness.boxB.boxId,
    );
    const [attempt] = await withBoxScope(
      harness.database,
      { boxId: harness.boxB.boxId },
      (transaction) =>
        transaction
          .insert(paymentAttempts)
          .values({
            boxId: harness.boxB.boxId,
            accountId: accountB,
            chargeId: charge.id,
            memberId: member.memberId,
            kind: 'link',
            amountGs: 70_000,
          })
          .returning(),
    );
    expect((await webhook(accountA, attempt?.orderNumber ?? 0, 70_000)).status).toBe(200);
    expect(await attemptsOf(charge.id)).toEqual([expect.objectContaining({ status: 'pending' })]);
  });

  it('keeps each action to the roles allowed to do it', async () => {
    const reception = await userIn(harness, 'reception');
    const coach = await userIn(harness, 'coach');
    const member = await userIn(harness, 'member');
    const admin = await userIn(harness, 'box_admin');
    const someId = crypto.randomUUID();
    const refused = [
      await reception.browser.patch('/box/card-payments/account', { autopayEnabled: false }),
      await reception.browser.delete('/box/card-payments/account'),
      await reception.browser.post(`/box/card-payments/payments/${someId}/refund`),
      await coach.browser.get('/box/card-payments/attempts'),
      await coach.browser.get(`/box/card-payments/members/${member.memberId}/cards`),
      await member.browser.get('/box/card-payments/attempts'),
      await member.browser.post('/box/card-payments/links', { chargeId: someId }),
      await member.browser.get(`/box/card-payments/members/${member.memberId}/cards`),
      await admin.browser.delete('/box/card-payments/account'),
    ];
    expect(refused.map((response) => response.status)).toEqual(Array(refused.length).fill(403));
  });

  it('opens only the exact webhook and payment link routes without a session', async () => {
    const other = await harness.app.request(
      `/webhooks/payments/${accountA}/extra`,
      { method: 'POST' },
      testEnv,
    );
    expect(other.status).toBe(403);
    const deleted = await harness.app.request(
      `/pay/${'a'.repeat(43)}`,
      { method: 'DELETE', headers: { origin: APP_ORIGIN } },
      testEnv,
    );
    expect(deleted.status).toBe(401);
  });
});
