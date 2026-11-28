import { auditLogs, paymentAccounts, savedCards } from '@guaranix/db/schema';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  enableCardPayments,
  MOCK_ACCOUNT,
  openCharge,
  systemRows,
  userIn,
} from './card-payments-helpers';
import { createHarness, type Harness, testEnv } from './harness';

let harness: Harness;
let owner: Awaited<ReturnType<typeof userIn>>;

beforeAll(async () => {
  harness = await createHarness();
  owner = await userIn(harness, 'box_owner');
}, 60_000);

afterAll(async () => {
  await harness.close();
});

describe('box payment account', () => {
  it('is refused until the GuaraniX plan or the platform includes card payments', async () => {
    const settings = await owner.browser.get('/box/card-payments/settings');
    expect(await settings.json()).toMatchObject({ included: false, account: null });
    const refused = await owner.browser.put('/box/card-payments/account', MOCK_ACCOUNT);
    expect(refused.status).toBe(422);
    expect(await refused.json()).toEqual({ error: 'feature_not_included' });
  });

  it('only the owner connects it; the private key is sealed and never comes back', async () => {
    await enableCardPayments(harness, harness.boxA.boxId);
    const admin = await userIn(harness, 'box_admin');
    expect((await admin.browser.put('/box/card-payments/account', MOCK_ACCOUNT)).status).toBe(403);

    const connected = await owner.browser.put('/box/card-payments/account', MOCK_ACCOUNT);
    expect(connected.status).toBe(200);
    const body = JSON.stringify(await connected.json());
    expect(body).not.toContain(MOCK_ACCOUNT.privateKey);
    expect(body).toContain('"privateKeyHint":"0001"');
    expect(body).toMatch(
      /"webhookUrl":"http:\/\/localhost:8787\/webhooks\/payments\/[0-9a-f-]{36}"/,
    );

    const [stored] = await systemRows(harness, (transaction) =>
      transaction
        .select()
        .from(paymentAccounts)
        .where(eq(paymentAccounts.boxId, harness.boxA.boxId)),
    );
    expect(stored?.encryptedPrivateKey).not.toContain(MOCK_ACCOUNT.privateKey);
    // The keys were tried with the processor before being saved.
    expect(harness.payments.configs.at(-1)?.privateKey).toBe(MOCK_ACCOUNT.privateKey);

    const audit = await systemRows(harness, (transaction) =>
      transaction
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.boxId, harness.boxA.boxId),
            eq(auditLogs.action, 'payment_account.connected'),
          ),
        ),
    );
    expect(JSON.stringify(audit)).not.toContain(MOCK_ACCOUNT.privateKey);
    expect(audit).toHaveLength(1);
  });

  it('rejects keys the processor refuses', async () => {
    const refused = await owner.browser.put('/box/card-payments/account', {
      ...MOCK_ACCOUNT,
      privateKey: 'invalid-key-0002', // secret-scan-ignore: fake key for tests
    });
    expect(await refused.json()).toEqual({ error: 'payment_keys_rejected' });
    // The account keeps the keys that worked.
    const settings = await owner.browser.get('/box/card-payments/settings');
    expect(await settings.json()).toMatchObject({ account: { privateKeyHint: '0001' } });
  });

  it('never lets another box see the account', async () => {
    const other = await userIn(harness, 'box_owner', harness.boxB.boxId);
    const settings = await other.browser.get('/box/card-payments/settings');
    expect(await settings.json()).toMatchObject({ account: null });
  });
});

describe('member card', () => {
  it('saves a card on the processor form and activates it only once confirmed', async () => {
    const member = await userIn(harness, 'member');
    const before = await member.browser.get('/box/card-payments/me/cards');
    expect(await before.json()).toEqual({ available: true, autopayEnabled: true, cards: [] });

    expect((await member.browser.post('/box/card-payments/me/cards', {})).status).toBe(400);
    const started = await member.browser.post('/box/card-payments/me/cards', {
      acceptAutopay: true,
    });
    expect(started.status).toBe(201);
    const { card, checkout } = (await started.json()) as {
      card: { id: string; status: string };
      checkout: { kind: string; form: string };
    };
    expect(card.status).toBe('pending');
    expect(checkout).toMatchObject({ kind: 'mock', form: 'card' });

    const confirmed = await member.browser.post(`/box/card-payments/me/cards/${card.id}/confirm`);
    expect(await confirmed.json()).toMatchObject({
      card: { status: 'active', brand: 'Visa', last4: expect.stringMatching(/^\d{4}$/) },
    });
    // The processor reference never reaches the app.
    expect(
      JSON.stringify(await (await member.browser.get('/box/card-payments/me/cards')).json()),
    ).not.toContain('cardRef');

    // A second card replaces the first.
    const second = (await (
      await member.browser.post('/box/card-payments/me/cards', { acceptAutopay: true })
    ).json()) as { card: { id: string } };
    await member.browser.post(`/box/card-payments/me/cards/${second.card.id}/confirm`);
    const active = await systemRows(harness, (transaction) =>
      transaction
        .select()
        .from(savedCards)
        .where(and(eq(savedCards.memberId, member.memberId), eq(savedCards.status, 'active'))),
    );
    expect(active.map((row) => row.id)).toEqual([second.card.id]);
  });

  it('does not activate a card the member never finished saving', async () => {
    const member = await userIn(harness, 'member');
    const { card } = (await (
      await member.browser.post('/box/card-payments/me/cards', { acceptAutopay: true })
    ).json()) as { card: { id: string } };
    const [row] = await systemRows(harness, (transaction) =>
      transaction.select().from(savedCards).where(eq(savedCards.id, card.id)),
    );
    harness.payments.behaviour = { unfinishedCards: new Set([row?.cardRef ?? '']) };
    const refused = await member.browser.post(`/box/card-payments/me/cards/${card.id}/confirm`);
    harness.payments.behaviour = {};
    expect(await refused.json()).toEqual({ error: 'card_not_saved' });
  });

  it("can't touch another member's card", async () => {
    const first = await userIn(harness, 'member');
    const second = await userIn(harness, 'member');
    const { card } = (await (
      await first.browser.post('/box/card-payments/me/cards', { acceptAutopay: true })
    ).json()) as { card: { id: string } };
    expect((await second.browser.delete(`/box/card-payments/me/cards/${card.id}`)).status).toBe(
      404,
    );
    expect(
      (await second.browser.post(`/box/card-payments/me/cards/${card.id}/confirm`)).status,
    ).toBe(404);
  });

  it('is unavailable in a box that does not take cards', async () => {
    const member = await userIn(harness, 'member', harness.boxB.boxId);
    const refused = await member.browser.post('/box/card-payments/me/cards', {
      acceptAutopay: true,
    });
    expect(await refused.json()).toEqual({ error: 'card_payments_unavailable' });
  });
});

describe('payment links', () => {
  it('front desk makes a link with a WhatsApp message; the page shows only the charge', async () => {
    const member = await userIn(harness, 'member');
    const charge = await openCharge(harness, member.memberId, 250_000);
    const reception = await userIn(harness, 'reception');
    const created = await reception.browser.post('/box/card-payments/links', {
      chargeId: charge.id,
    });
    expect(created.status).toBe(201);
    const { link } = (await created.json()) as { link: { url: string; whatsappUrl: string } };
    expect(link.url).toMatch(/^http:\/\/localhost:5173\/pagar\/[\w-]{43}$/);
    expect(link.whatsappUrl).toMatch(/^https:\/\/wa\.me\/595981123456\?text=/);
    expect(decodeURIComponent(link.whatsappUrl)).toContain('₲ 250.000');

    const token = link.url.split('/').at(-1) ?? '';
    const anonymous = await harness.app.request(`/pay/${token}`, {}, testEnv);
    expect(await anonymous.json()).toEqual({
      link: expect.objectContaining({ status: 'payable', amountGs: 250_000, firstName: 'Ana' }),
    });
    const unknown = await harness.app.request(`/pay/${'a'.repeat(43)}`, {}, testEnv);
    expect(unknown.status).toBe(404);
  });

  it('a member pays through the link and the charge is settled once', async () => {
    const member = await userIn(harness, 'member');
    const charge = await openCharge(harness, member.memberId, 180_000);
    const reception = await userIn(harness, 'reception');
    const { link } = (await (
      await reception.browser.post('/box/card-payments/links', { chargeId: charge.id })
    ).json()) as { link: { url: string } };
    const token = link.url.split('/').at(-1) ?? '';
    const post = (path: string, body?: unknown) =>
      harness.app.request(
        path,
        {
          method: 'POST',
          headers: { origin: 'http://localhost:5173', 'content-type': 'application/json' },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
        testEnv,
      );

    const checkout = await post(`/pay/${token}/checkout`);
    expect(await checkout.json()).toMatchObject({ checkout: { kind: 'mock', form: 'payment' } });
    const simulated = await post(`/pay/${token}/simulate`, { approved: true });
    expect(await simulated.json()).toEqual({ accepted: true });

    const page = await harness.app.request(`/pay/${token}`, {}, testEnv);
    expect(await page.json()).toMatchObject({ link: { status: 'paid', amountGs: 0 } });
    const again = await post(`/pay/${token}/checkout`);
    expect(await again.json()).toEqual({ error: 'payment_link_paid' });
  });
});
