import { oauthAccounts, userCredentials, users } from '@guaranix/db/schema';
import type { Session } from '@guaranix/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  APP_ORIGIN,
  type Browser,
  createBrowser,
  createHarness,
  type Harness,
  signedUpBrowser,
  uniqueEmail,
} from './harness';

let harness: Harness;
let subjectCounter = 0;

beforeAll(async () => {
  harness = await createHarness();
});

afterAll(async () => {
  await harness.close();
});

const returnTo = `${APP_ORIGIN}/`;

function googleIdentity(email: string | null, emailVerified = true) {
  return { subject: `google-${(subjectCounter += 1)}`, email, emailVerified, name: 'Ana Google' };
}

/** Runs start → Google → callback and returns the final redirect. */
async function googleFlow(browser: Browser, intent: 'login' | 'link' = 'login') {
  const params = new URLSearchParams({ intent, returnTo });
  const start = await browser.get(`/auth/google/start?${params.toString()}`);
  expect(start.status).toBe(302);
  const googleUrl = new URL(start.headers.get('location') ?? '');
  const state = googleUrl.searchParams.get('state') ?? '';
  return browser.get(`/auth/google/callback?code=fake-code&state=${state}`);
}

const errorOf = (response: Response) =>
  new URL(response.headers.get('location') ?? '').searchParams.get('auth_error');

describe('Google login', () => {
  it('creates an account with a verified email and logs in', async () => {
    const browser = createBrowser(harness);
    const email = uniqueEmail('google');
    harness.google.nextIdentity = googleIdentity(email);
    const callback = await googleFlow(browser);
    expect(callback.headers.get('location')).toBe(returnTo);
    const session = (await (await browser.get('/auth/session')).json()) as Session;
    expect(session.user.email).toBe(email);
    expect(session.googleLinked).toBe(true);
    expect(session.hasPassword).toBe(false);
  });

  it('logs into the same account the next time by Google id', async () => {
    const identity = googleIdentity(uniqueEmail('google'));
    harness.google.nextIdentity = identity;
    await googleFlow(createBrowser(harness));
    harness.google.nextIdentity = { ...identity, email: uniqueEmail('changed') };
    const browser = createBrowser(harness);
    await googleFlow(browser);
    const session = (await (await browser.get('/auth/session')).json()) as Session;
    expect(session.user.email).toBe(identity.email);
  });

  it('refuses Google accounts without a verified email', async () => {
    harness.google.nextIdentity = googleIdentity(uniqueEmail('google'), false);
    const callback = await googleFlow(createBrowser(harness));
    expect(errorOf(callback)).toBe('google_failed');
  });

  it('links to staff created by a box (verified by Google now)', async () => {
    harness.google.nextIdentity = googleIdentity('owner@box-b.local');
    const browser = createBrowser(harness);
    await googleFlow(browser);
    const session = (await (await browser.get('/auth/session')).json()) as Session;
    expect(session.user.id).toBe(harness.boxB.ownerId);
    expect(session.activeBoxId).toBe(harness.boxB.boxId);
  });

  it('removes a password someone set on an unverified email (pre-account hijacking)', async () => {
    const attacker = await signedUpBrowser(harness, 'attacker password');
    harness.google.nextIdentity = googleIdentity(attacker.email);
    const victim = createBrowser(harness);
    await googleFlow(victim);

    expect((await attacker.browser.get('/auth/session')).status).toBe(401);
    const relogin = await createBrowser(harness).post('/auth/login', {
      email: attacker.email,
      password: 'attacker password',
      captchaToken: 'ok',
    });
    expect(relogin.status).toBe(401);
    const credentials = await harness.database
      .select()
      .from(userCredentials)
      .where(eq(userCredentials.userId, attacker.session.user.id));
    expect(credentials).toEqual([]);
  });

  it('rejects a callback whose state does not match', async () => {
    const browser = createBrowser(harness);
    harness.google.nextIdentity = googleIdentity(uniqueEmail('google'));
    const params = new URLSearchParams({ intent: 'login', returnTo });
    await browser.get(`/auth/google/start?${params.toString()}`);
    const callback = await browser.get('/auth/google/callback?code=x&state=forged');
    expect(errorOf(callback)).toBe('google_failed');
    expect((await browser.get('/auth/session')).status).toBe(401);
  });

  it('rejects a callback without our state cookie', async () => {
    const callback = await createBrowser(harness).get('/auth/google/callback?code=x&state=y');
    expect(callback.status).toBe(400);
  });

  it('never redirects outside our apps', async () => {
    const params = new URLSearchParams({ intent: 'login', returnTo: 'https://evil.example/' });
    const response = await createBrowser(harness).get(`/auth/google/start?${params.toString()}`);
    expect(response.status).toBe(400);
  });
});

describe('linking Google from the account', () => {
  it('links Google to a password account', async () => {
    const { browser } = await signedUpBrowser(harness);
    harness.google.nextIdentity = googleIdentity(uniqueEmail('other'));
    const callback = await googleFlow(browser, 'link');
    expect(errorOf(callback)).toBeNull();
    const session = (await (await browser.get('/auth/session')).json()) as Session;
    expect(session.googleLinked).toBe(true);
    expect(session.hasPassword).toBe(true);
  });

  it('refuses a Google account already linked to someone else', async () => {
    const identity = googleIdentity(uniqueEmail('google'));
    harness.google.nextIdentity = identity;
    await googleFlow(createBrowser(harness));
    const { browser } = await signedUpBrowser(harness);
    harness.google.nextIdentity = identity;
    expect(errorOf(await googleFlow(browser, 'link'))).toBe('google_already_linked');
  });

  it('needs a session to link', async () => {
    const params = new URLSearchParams({ intent: 'link', returnTo });
    const response = await createBrowser(harness).get(`/auth/google/start?${params.toString()}`);
    expect(errorOf(response)).toBe('unauthenticated');
  });

  it('lets a Google user add a password without a current one', async () => {
    const browser = createBrowser(harness);
    harness.google.nextIdentity = googleIdentity(uniqueEmail('google'));
    await googleFlow(browser);
    await browser.get('/auth/session');
    const response = await browser.post('/auth/password', { newPassword: 'my first password' });
    expect(((await response.json()) as Session).hasPassword).toBe(true);
  });

  it('refuses to unlink Google when it is the only way in', async () => {
    const browser = createBrowser(harness);
    harness.google.nextIdentity = googleIdentity(uniqueEmail('google'));
    await googleFlow(browser);
    await browser.get('/auth/session');
    const response = await browser.delete('/auth/google');
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'last_sign_in_method' });
  });

  it('unlinks Google when the user also has a password', async () => {
    const { browser, session } = await signedUpBrowser(harness);
    harness.google.nextIdentity = googleIdentity(uniqueEmail('other'));
    await googleFlow(browser, 'link');
    const response = await browser.delete('/auth/google');
    expect(((await response.json()) as Session).googleLinked).toBe(false);
    const linked = await harness.database
      .select()
      .from(oauthAccounts)
      .where(eq(oauthAccounts.userId, session.user.id));
    expect(linked).toEqual([]);
  });
});

describe('config', () => {
  it('tells the apps whether Google and captcha are on', async () => {
    const response = await createBrowser(harness).get('/auth/config');
    expect(await response.json()).toEqual({ googleEnabled: true, turnstileSiteKey: 'site-key' });
  });

  it('keeps the verified email when Google signs in an existing verified user', async () => {
    const email = uniqueEmail('google');
    harness.google.nextIdentity = googleIdentity(email);
    await googleFlow(createBrowser(harness));
    const [user] = await harness.database.select().from(users).where(eq(users.email, email));
    expect(user?.emailVerifiedAt).not.toBeNull();
  });
});
