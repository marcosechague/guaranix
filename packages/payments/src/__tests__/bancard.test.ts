import { describe, expect, it } from 'vitest';
import { PaymentProviderError } from '../errors';
import { createBancardProvider } from '../providers/bancard/adapter';
import { bancardTokens, md5 } from '../providers/bancard/tokens';

const PRIVATE_KEY = 'private-test-key';

interface Sent {
  url: string;
  method: string;
  body: { public_key: string; operation: Record<string, unknown> };
}

function bancard(answer: (sent: Sent) => Response | Promise<Response>) {
  const sent: Sent[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const entry = {
      url: request.url,
      method: request.method,
      body: (await request.json()) as Sent['body'],
    };
    sent.push(entry);
    return answer(entry);
  };
  const provider = createBancardProvider({
    provider: 'bancard',
    environment: 'sandbox',
    publicKey: 'public-test-key',
    privateKey: PRIVATE_KEY,
    fetch: fetchImpl,
  });
  return { provider, sent };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const cardsAnswer = () =>
  json({
    status: 'success',
    cards: [
      {
        alias_token: 'alias-1',
        card_masked_number: '541863******1234',
        expiration_date: '08/29',
        card_brand: 'Mastercard',
        card_id: 555,
      },
    ],
  });

async function errorCode(work: Promise<unknown>) {
  const error = await work.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(PaymentProviderError);
  return (error as PaymentProviderError).code;
}

describe('Bancard tokens', () => {
  it('follow the field order of each operation', () => {
    expect(bancardTokens.singleBuy('k', 7, '100.00')).toBe(md5('k7100.00PYG'));
    expect(bancardTokens.rollback('k', 7)).toBe(md5('k7rollback0.00'));
    expect(bancardTokens.confirmation('k', 7)).toBe(md5('k7get_confirmation'));
    expect(bancardTokens.webhook('k', '7', '100.00', 'PYG')).toBe(md5('k7confirm100.00PYG'));
  });
});

describe('Bancard adapter', () => {
  it('opens the card form with our numbers and the sandbox script', async () => {
    const { provider, sent } = bancard(() => json({ status: 'success', process_id: 'proc-1' }));
    const checkout = await provider.startCardRegistration({
      customerRef: '100001',
      cardRef: '100002',
      email: 'ana@example.com',
      phone: null,
      returnUrl: 'https://app.test/tarjeta',
    });
    expect(checkout).toEqual({
      kind: 'bancard',
      form: 'card',
      processId: 'proc-1',
      scriptUrl: expect.stringMatching(/^https:\/\/vpos\.infonet\.com\.py:8888\/checkout\//),
    });
    expect(sent[0]?.url).toBe('https://vpos.infonet.com.py:8888/vpos/api/0.3/cards/new');
    expect(sent[0]?.body).toMatchObject({
      public_key: 'public-test-key',
      operation: {
        card_id: 100002,
        user_id: 100001,
        user_mail: 'ana@example.com',
        token: bancardTokens.newCard(PRIVATE_KEY, '100002', '100001'),
      },
    });
  });

  it('reads the saved card with only its last four digits', async () => {
    const { provider } = bancard(cardsAnswer);
    expect(await provider.findCard({ customerRef: '1', cardRef: '555' })).toEqual({
      cardRef: '555',
      brand: 'Mastercard',
      last4: '1234',
      expiresOn: '08/29',
    });
    expect(await provider.findCard({ customerRef: '1', cardRef: '999' })).toBeNull();
  });

  it('charges with a fresh alias token and reads the approval', async () => {
    const { provider, sent } = bancard((request) =>
      request.url.endsWith('/charge')
        ? json({
            status: 'success',
            confirmation: {
              shop_process_id: 900,
              response: 'S',
              response_code: '00',
              amount: '300000.00',
              currency: 'PYG',
              authorization_number: '123456',
              ticket_number: '777',
            },
          })
        : cardsAnswer(),
    );
    const outcome = await provider.chargeCard({
      customerRef: '1',
      cardRef: '555',
      orderNumber: 900,
      amountGs: 300_000,
      description: 'Cuota mensual de diciembre',
    });
    expect(outcome).toEqual({
      status: 'approved',
      amountGs: 300_000,
      authorizationCode: '123456',
      providerReference: '777',
    });
    const charge = sent[1]?.body.operation;
    expect(charge).toMatchObject({
      shop_process_id: 900,
      amount: '300000.00',
      alias_token: 'alias-1',
      description: 'Cuota mensual de dic',
      token: bancardTokens.charge(PRIVATE_KEY, 900, '300000.00', 'alias-1'),
    });
  });

  it('treats any code but 00, or an error answer, as a decline', async () => {
    const declined = bancard((request) =>
      request.url.endsWith('/charge')
        ? json({
            status: 'success',
            confirmation: {
              response_code: '51',
              amount: '300000.00',
              response_description: 'Fondos insuficientes',
            },
          })
        : cardsAnswer(),
    );
    const input = {
      customerRef: '1',
      cardRef: '555',
      orderNumber: 1,
      amountGs: 300_000,
      description: 'x',
    };
    expect(await declined.provider.chargeCard(input)).toEqual({
      status: 'declined',
      declineCode: '51',
      declineMessage: 'Fondos insuficientes',
    });
    const refused = bancard((request) =>
      request.url.endsWith('/charge')
        ? json({ status: 'error', messages: [{ key: 'CardBlocked', dsc: 'Tarjeta bloqueada' }] })
        : cardsAnswer(),
    );
    expect(await refused.provider.chargeCard(input)).toMatchObject({
      status: 'declined',
      declineCode: 'CardBlocked',
    });
  });

  it('reports outages and bad keys as errors, never as an outcome', async () => {
    const input = {
      customerRef: '1',
      cardRef: '555',
      orderNumber: 1,
      amountGs: 1000,
      description: 'x',
    };
    const down = bancard(() => new Response('oops', { status: 502 }));
    expect(await errorCode(down.provider.chargeCard(input))).toBe('unavailable');
    const offline = bancard(() => Promise.reject(new TypeError('network')));
    expect(await errorCode(offline.provider.chargeCard(input))).toBe('unavailable');
    const wrongKeys = bancard(() =>
      json({ status: 'error', messages: [{ key: 'InvalidPublicKeyError' }] }, 401),
    );
    expect(await errorCode(wrongKeys.provider.verifyCredentials())).toBe('auth');
  });

  it('asks for the status of an order and knows when it never happened', async () => {
    const missing = bancard(() =>
      json({ status: 'error', messages: [{ key: 'PaymentNotFoundError' }] }),
    );
    expect(await missing.provider.getPaymentStatus(5)).toEqual({ status: 'not_found' });
    expect(missing.sent[0]?.body.operation['token']).toBe(
      bancardTokens.confirmation(PRIVATE_KEY, 5),
    );
  });

  it('refunds by rollback, and says when Bancard no longer allows it', async () => {
    const ok = bancard(() => json({ status: 'success' }));
    await ok.provider.refund({ orderNumber: 5, amountGs: 1000 });
    expect(ok.sent[0]?.url).toMatch(/single_buy\/rollback$/);
    const closed = bancard(() =>
      json({ status: 'error', messages: [{ key: 'TransactionAlreadyConfirmed' }] }),
    );
    expect(await errorCode(closed.provider.refund({ orderNumber: 5, amountGs: 1000 }))).toBe(
      'not_supported',
    );
  });
});

describe('Bancard confirmation webhook', () => {
  const { provider } = bancard(() => json({}));
  const webhook = (operation: Record<string, unknown>) => ({
    body: JSON.stringify({ operation }),
    headers: new Headers(),
  });
  const signed = (fields: Record<string, unknown>) => ({
    shop_process_id: 4321,
    amount: '150000.00',
    currency: 'PYG',
    response_code: '00',
    authorization_number: '999',
    ticket_number: '888',
    token: md5(`${PRIVATE_KEY}4321confirm150000.00PYG`),
    ...fields,
  });

  it('accepts a confirmation signed with the private key', async () => {
    const event = await provider.parseWebhook(webhook(signed({})));
    expect(event).toMatchObject({
      eventKey: 'confirm:4321',
      orderNumber: 4321,
      outcome: { status: 'approved', amountGs: 150_000, authorizationCode: '999' },
    });
    expect(JSON.stringify(event.summary)).not.toContain(PRIVATE_KEY);
    expect(event.summary).not.toHaveProperty('token');
  });

  it('rejects a forged token, a changed amount or a broken body', async () => {
    expect(await errorCode(provider.parseWebhook(webhook(signed({ token: md5('forged') }))))).toBe(
      'invalid_signature',
    );
    expect(await errorCode(provider.parseWebhook(webhook(signed({ amount: '1.00' }))))).toBe(
      'invalid_signature',
    );
    expect(
      await errorCode(provider.parseWebhook({ body: 'not json', headers: new Headers() })),
    ).toBe('invalid_signature');
  });
});
