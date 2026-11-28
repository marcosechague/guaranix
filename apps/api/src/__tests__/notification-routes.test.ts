import {
  boxUsers,
  classes,
  programs,
  pushSubscriptions,
  telegramLinkCodes,
  telegramLinks,
} from '@guaranix/db/schema';
import type { NotificationSettings, Session, TelegramLinkStart } from '@guaranix/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBrowser, createHarness, type Harness, signedUpBrowser, testEnv } from './harness';

let harness: Harness;

beforeAll(async () => {
  harness = await createHarness();
});

afterAll(async () => {
  await harness.close();
});

async function signedInAgain(email: string, password: string) {
  const browser = createBrowser(harness);
  await browser.post('/auth/login', { email, password, captchaToken: 'ok' });
  return browser;
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

const subscription = (endpoint = 'https://fcm.googleapis.com/fcm/send/abc') => ({
  endpoint,
  keys: {
    p256dh:
      'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
    auth: 'tBHItJI5svbpez7KI4CCXg', // gitleaks:allow (made-up test subscription)
  },
});

function webhook(body: unknown, secret = 'telegram-webhook-secret') {
  // No Origin and no cookie, like Telegram's servers.
  return harness.app.request(
    '/integrations/telegram/webhook',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': secret },
      body: JSON.stringify(body),
    },
    testEnv,
  );
}

const startUpdate = (text: string, chatId = 9001) => ({
  update_id: 1,
  message: { text, chat: { id: chatId, type: 'private' }, from: { username: 'coach_ana' } },
});

describe('notification settings', () => {
  it('need a session', async () => {
    expect((await createBrowser(harness).get('/notifications/settings')).status).toBe(401);
  });

  it('start with everything on and can turn one topic off', async () => {
    const { browser } = await signedUpBrowser(harness);
    const initial = await json<NotificationSettings>(await browser.get('/notifications/settings'));
    expect(initial.preferences.every((preference) => preference.enabled)).toBe(true);
    expect(initial.preferences).toContainEqual({
      topic: 'billing',
      channel: 'whatsapp',
      enabled: true,
    });
    expect(initial.push).toEqual({
      available: true,
      publicKey: 'BPublicKeyForTests',
      subscriptions: 0,
    });
    expect(initial.telegram).toEqual({ available: true, linked: false, username: null });

    const off = await browser.put('/notifications/preferences', {
      topic: 'workouts',
      channel: 'push',
      enabled: false,
    });
    expect(off.status).toBe(200);
    const after = await json<NotificationSettings>(await browser.get('/notifications/settings'));
    expect(after.preferences).toContainEqual({
      topic: 'workouts',
      channel: 'push',
      enabled: false,
    });
  });

  it('reject a channel the topic never uses', async () => {
    const { browser } = await signedUpBrowser(harness);
    const response = await browser.put('/notifications/preferences', {
      topic: 'bookings',
      channel: 'whatsapp',
      enabled: false,
    });
    expect(response.status).toBe(400);
  });
});

describe('push subscriptions', () => {
  it('saves one per browser and moves it to whoever logs in there next', async () => {
    const ana = await signedUpBrowser(harness);
    const beto = await signedUpBrowser(harness);
    const endpoint = 'https://fcm.googleapis.com/fcm/send/shared-browser';
    expect(
      (await ana.browser.post('/notifications/push-subscriptions', subscription(endpoint))).status,
    ).toBe(201);
    expect(
      (await beto.browser.post('/notifications/push-subscriptions', subscription(endpoint))).status,
    ).toBe(201);

    const count = async (who: typeof ana) =>
      (await json<NotificationSettings>(await who.browser.get('/notifications/settings'))).push
        .subscriptions;
    expect(await count(ana)).toBe(0);
    expect(await count(beto)).toBe(1);

    // Ana can't remove Beto's.
    await ana.browser.post('/notifications/push-subscriptions/remove', { endpoint });
    expect(await count(beto)).toBe(1);
    await beto.browser.post('/notifications/push-subscriptions/remove', { endpoint });
    expect(await count(beto)).toBe(0);
  });

  it('only accepts browser push services', async () => {
    const { browser } = await signedUpBrowser(harness);
    const response = await browser.post(
      '/notifications/push-subscriptions',
      subscription('https://attacker.example.com/push'),
    );
    expect(response.status).toBe(400);
  });

  it('keeps only the newest ten browsers per person', async () => {
    const ana = await signedUpBrowser(harness);
    for (let device = 0; device < 12; device += 1) {
      await ana.browser.post(
        '/notifications/push-subscriptions',
        subscription(`https://fcm.googleapis.com/fcm/send/ana-${device}`),
      );
    }
    const settings = await json<NotificationSettings>(
      await ana.browser.get('/notifications/settings'),
    );
    expect(settings.push.subscriptions).toBe(10);
  });

  it('unlinks only this browser when the person logs out', async () => {
    const ana = await signedUpBrowser(harness);
    const phone = 'https://fcm.googleapis.com/fcm/send/ana-phone';
    const laptop = 'https://fcm.googleapis.com/fcm/send/ana-laptop';
    await ana.browser.post('/notifications/push-subscriptions', subscription(phone));
    await ana.browser.post('/notifications/push-subscriptions', subscription(laptop));
    expect((await ana.browser.post('/auth/logout', { pushEndpoint: phone })).status).toBe(204);
    const left = await harness.database
      .select({ endpoint: pushSubscriptions.endpoint })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, ana.session.user.id));
    expect(left).toEqual([{ endpoint: laptop }]);
  });

  it('forgets linked browsers and Telegram after a password reset', async () => {
    const ana = await signedUpBrowser(harness);
    await ana.browser.post(
      '/notifications/push-subscriptions',
      subscription('https://fcm.googleapis.com/fcm/send/ana-reset'),
    );
    await harness.database
      .insert(telegramLinks)
      .values({ userId: ana.session.user.id, chatId: 'chat-of-whoever-had-the-session' });
    const browser = createBrowser(harness);
    await browser.post('/auth/password/forgot', { email: ana.email, captchaToken: 'ok' });
    const token = decodeURIComponent(
      harness.emails.sent.at(-1)?.text.match(/token=([\w%-]+)/)?.[1] ?? '',
    );
    expect(
      (await browser.post('/auth/password/reset', { token, password: 'a brand new password' }))
        .status,
    ).toBe(200);
    const links = await harness.database
      .select()
      .from(telegramLinks)
      .where(eq(telegramLinks.userId, ana.session.user.id));
    expect(links).toEqual([]);
    const fresh = await signedInAgain(ana.email, 'a brand new password');
    const settings = await json<NotificationSettings>(await fresh.get('/notifications/settings'));
    expect(settings.push.subscriptions).toBe(0);
  });

  it('rejects endpoints that are not https', async () => {
    const { browser } = await signedUpBrowser(harness);
    const response = await browser.post(
      '/notifications/push-subscriptions',
      subscription('http://evil.example.com/push'),
    );
    expect(response.status).toBe(400);
  });
});

describe('telegram linking', () => {
  async function linkCode(browser: ReturnType<typeof createBrowser>) {
    const response = await browser.post('/notifications/telegram/link');
    expect(response.status).toBe(201);
    const link = await json<TelegramLinkStart>(response);
    expect(link.url).toMatch(/^https:\/\/t\.me\/GuaranixTestBot\?start=[\w-]{32}$/);
    return new URL(link.url).searchParams.get('start') ?? '';
  }

  it('links the chat that sends /start with the code, once', async () => {
    const { browser, session } = await signedUpBrowser(harness);
    const code = await linkCode(browser);

    expect((await webhook(startUpdate(`/start ${code}`))).status).toBe(200);
    const settings = await json<NotificationSettings>(await browser.get('/notifications/settings'));
    expect(settings.telegram).toMatchObject({ linked: true, username: 'coach_ana' });
    const [link] = await harness.database
      .select()
      .from(telegramLinks)
      .where(eq(telegramLinks.userId, session.user.id));
    expect(link?.chatId).toBe('9001');
    expect(harness.channels.telegram.sent.at(-1)?.message.body).toContain('Listo');

    // The code is spent: a second /start (another chat) links nothing.
    await webhook(startUpdate(`/start ${code}`, 9002));
    expect(harness.channels.telegram.sent.at(-1)?.message.body).toContain('ya no sirve');
    const [still] = await harness.database
      .select()
      .from(telegramLinks)
      .where(eq(telegramLinks.userId, session.user.id));
    expect(still?.chatId).toBe('9001');

    expect((await browser.delete('/notifications/telegram/link')).status).toBe(200);
    const unlinked = await json<NotificationSettings>(await browser.get('/notifications/settings'));
    expect(unlinked.telegram.linked).toBe(false);
  });

  it('refuses an expired code', async () => {
    const { browser, session } = await signedUpBrowser(harness);
    const code = await linkCode(browser);
    await harness.database
      .update(telegramLinkCodes)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(telegramLinkCodes.userId, session.user.id));
    await webhook(startUpdate(`/start ${code}`, 9100));
    const settings = await json<NotificationSettings>(await browser.get('/notifications/settings'));
    expect(settings.telegram.linked).toBe(false);
  });

  it('only answers Telegram: a wrong or missing secret is refused', async () => {
    expect((await webhook(startUpdate('/start x'), 'wrong')).status).toBe(403);
    const response = await harness.app.request(
      '/integrations/telegram/webhook',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
      testEnv,
    );
    expect(response.status).toBe(403);
  });

  it('ignores updates that are not /start', async () => {
    const before = harness.channels.telegram.sent.length;
    expect(
      (await webhook({ update_id: 2, message: { text: 'hola', chat: { id: 1, type: 'private' } } }))
        .status,
    ).toBe(200);
    expect(harness.channels.telegram.sent).toHaveLength(before);
  });
});

describe('box requests queue their notifications after commit', () => {
  async function owner() {
    const signed = await signedUpBrowser(harness);
    await harness.database
      .insert(boxUsers)
      .values({ boxId: harness.boxA.boxId, userId: signed.session.user.id, role: 'box_owner' });
    const response = await signed.browser.post('/auth/login', {
      email: signed.email,
      password: signed.password,
      captchaToken: 'ok',
    });
    return { ...signed, session: await json<Session>(response) };
  }

  it('queues a cancelled class, and nothing for a request that failed', async () => {
    const { browser } = await owner();
    const [program] = await harness.database
      .select()
      .from(programs)
      .where(eq(programs.boxId, harness.boxA.boxId));
    const startsAt = new Date(Date.now() + 48 * 3600_000);
    const [classRow] = await harness.database
      .insert(classes)
      .values({
        boxId: harness.boxA.boxId,
        programId: program?.id ?? '',
        startsAt,
        endsAt: new Date(startsAt.getTime() + 3600_000),
        capacity: 10,
      })
      .returning();
    harness.notificationQueue.jobs.length = 0;

    const missing = await browser.post(`/box/classes/${crypto.randomUUID()}/cancel`, {
      reason: null,
    });
    expect(missing.status).toBe(404);
    expect(harness.notificationQueue.jobs).toHaveLength(0);

    const cancelled = await browser.post(`/box/classes/${classRow?.id}/cancel`, {
      reason: 'Lluvia',
    });
    expect(cancelled.status).toBe(200);
    // No members booked, so only the staff notice (for the other managers, not whoever cancelled).
    expect(harness.notificationQueue.jobs).toEqual([
      { type: 'expand', notificationId: expect.any(String) },
    ]);
  });
});
