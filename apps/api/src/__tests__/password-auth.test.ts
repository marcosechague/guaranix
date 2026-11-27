import { userCredentials, users } from '@guaranix/db/schema';
import type { Session } from '@guaranix/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createBrowser,
  createHarness,
  type Harness,
  signedUpBrowser,
  uniqueEmail,
} from './harness';

let harness: Harness;

beforeAll(async () => {
  harness = await createHarness();
});

afterAll(async () => {
  await harness.close();
});

beforeEach(() => {
  harness.captcha.enabled = true;
  harness.captcha.passes = true;
});

const login = (browser = createBrowser(harness), email: string, password: string) =>
  browser.post('/auth/login', { email, password, captchaToken: 'ok' });

function resetTokenFromLastEmail() {
  const email = harness.emails.sent.at(-1);
  const token = email?.text.match(/token=([\w%-]+)/)?.[1];
  if (!token) throw new Error('No reset link in the last email');
  return decodeURIComponent(token);
}

describe('signup', () => {
  it('creates the account and logs in', async () => {
    const { session, email } = await signedUpBrowser(harness);
    expect(session.user.email).toBe(email);
    expect(session.hasPassword).toBe(true);
    expect(session.googleLinked).toBe(false);
    expect(session.memberships).toEqual([]);
  });

  it('normalizes the email', async () => {
    const browser = createBrowser(harness);
    const email = uniqueEmail();
    const response = await browser.post('/auth/signup', {
      fullName: 'Ana',
      email: `  ${email.toUpperCase()} `,
      password: 'long enough password',
      captchaToken: 'ok',
    });
    expect(((await response.json()) as Session).user.email).toBe(email);
  });

  it('refuses an email that already has an account', async () => {
    const { email } = await signedUpBrowser(harness);
    const response = await createBrowser(harness).post('/auth/signup', {
      fullName: 'Otra',
      email,
      password: 'another long password',
      captchaToken: 'ok',
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'email_taken' });
  });

  it('rejects short passwords', async () => {
    const response = await createBrowser(harness).post('/auth/signup', {
      fullName: 'Ana',
      email: uniqueEmail(),
      password: 'short',
      captchaToken: 'ok',
    });
    expect(response.status).toBe(400);
  });

  it('never stores the password in clear text', async () => {
    const { session, password } = await signedUpBrowser(harness);
    const [row] = await harness.database
      .select()
      .from(userCredentials)
      .where(eq(userCredentials.userId, session.user.id));
    expect(row?.passwordHash).toMatch(/^pbkdf2-sha256\$100000\$/);
    expect(row?.passwordHash).not.toContain(password);
  });
});

describe('login', () => {
  it('works with the right password', async () => {
    const { email, password } = await signedUpBrowser(harness);
    const response = await login(undefined, email, password);
    expect(response.status).toBe(200);
  });

  it('answers the same for a wrong password and an unknown email', async () => {
    const { email } = await signedUpBrowser(harness);
    const wrong = await login(undefined, email, 'not the password');
    const unknown = await login(undefined, uniqueEmail(), 'not the password');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
  });

  it('fails for accounts without a password (staff seeded by a box)', async () => {
    const response = await login(undefined, 'owner@box-a.local', 'anything at all');
    expect(response.status).toBe(401);
  });

  it('starts in the first box the user belongs to', async () => {
    const browser = createBrowser(harness);
    await browser.post('/auth/password/forgot', { email: 'coach@box-a.local', captchaToken: 'ok' });
    await browser.post('/auth/password/reset', {
      token: resetTokenFromLastEmail(),
      password: 'coach password 123',
    });
    const response = await login(undefined, 'coach@box-a.local', 'coach password 123');
    const session = (await response.json()) as Session;
    expect(session.activeBoxId).toBe(harness.boxA.boxId);
    expect(session.memberships).toEqual([
      { boxId: harness.boxA.boxId, boxName: 'Box Demo Asunción', role: 'coach' },
    ]);
  });
});

describe('captcha', () => {
  it('blocks login, signup and forgot password when it fails', async () => {
    harness.captcha.passes = false;
    const browser = createBrowser(harness);
    const body = {
      fullName: 'Ana',
      email: uniqueEmail(),
      password: 'long enough password',
      captchaToken: 'bad',
    };
    for (const path of ['/auth/signup', '/auth/login', '/auth/password/forgot']) {
      const response = await browser.post(path, body);
      expect(response.status, path).toBe(400);
      expect(await response.json()).toEqual({ error: 'captcha_failed' });
    }
  });

  it('is required when enabled', async () => {
    const { email, password } = await signedUpBrowser(harness);
    const response = await createBrowser(harness).post('/auth/login', { email, password });
    expect(response.status).toBe(400);
  });

  it('can be off in development', async () => {
    harness.captcha.enabled = false;
    const { email, password } = await signedUpBrowser(harness);
    const response = await createBrowser(harness).post('/auth/login', { email, password });
    expect(response.status).toBe(200);
  });
});

describe('rate limiting', () => {
  it('locks an email after 10 failed logins, even from different IPs', async () => {
    const { email, password } = await signedUpBrowser(harness);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await login(undefined, email, 'wrong password')).status).toBe(401);
    }
    const blocked = await login(undefined, email, password);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('limits reset emails per address', async () => {
    const { email } = await signedUpBrowser(harness);
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await createBrowser(harness).post('/auth/password/forgot', {
        email,
        captchaToken: 'ok',
      });
      statuses.push(response.status);
    }
    expect(statuses).toEqual([202, 202, 202, 429]);
  });
});

describe('forgot and reset password', () => {
  it('answers the same for unknown emails and sends nothing', async () => {
    const before = harness.emails.sent.length;
    const response = await createBrowser(harness).post('/auth/password/forgot', {
      email: uniqueEmail(),
      captchaToken: 'ok',
    });
    expect(response.status).toBe(202);
    expect(harness.emails.sent.length).toBe(before);
  });

  it('emails a link back to the app that asked', async () => {
    const { email } = await signedUpBrowser(harness);
    await createBrowser(harness, 'http://localhost:5174').post('/auth/password/forgot', {
      email,
      captchaToken: 'ok',
    });
    const sent = harness.emails.sent.at(-1);
    expect(sent?.to).toBe(email);
    expect(sent?.text).toContain('http://localhost:5174/reset-password?token=');
  });

  it('sets the new password, verifies the email and logs out other browsers', async () => {
    const { browser: oldBrowser, email, session } = await signedUpBrowser(harness);
    await createBrowser(harness).post('/auth/password/forgot', { email, captchaToken: 'ok' });
    const response = await createBrowser(harness).post('/auth/password/reset', {
      token: resetTokenFromLastEmail(),
      password: 'brand new password',
    });
    expect(response.status).toBe(200);
    expect((await oldBrowser.get('/auth/session')).status).toBe(401);
    expect((await login(undefined, email, 'brand new password')).status).toBe(200);
    const [user] = await harness.database.select().from(users).where(eq(users.id, session.user.id));
    expect(user?.emailVerifiedAt).not.toBeNull();
  });

  it('accepts each link only once', async () => {
    const { email } = await signedUpBrowser(harness);
    await createBrowser(harness).post('/auth/password/forgot', { email, captchaToken: 'ok' });
    const token = resetTokenFromLastEmail();
    const reset = (password: string) =>
      createBrowser(harness).post('/auth/password/reset', { token, password });
    expect((await reset('first new password')).status).toBe(200);
    const second = await reset('second new password');
    expect(second.status).toBe(400);
    expect(await second.json()).toEqual({ error: 'invalid_reset_token' });
  });

  it('only accepts the newest link', async () => {
    const { email } = await signedUpBrowser(harness);
    const browser = createBrowser(harness);
    await browser.post('/auth/password/forgot', { email, captchaToken: 'ok' });
    const older = resetTokenFromLastEmail();
    await browser.post('/auth/password/forgot', { email, captchaToken: 'ok' });
    const response = await browser.post('/auth/password/reset', {
      token: older,
      password: 'some new password',
    });
    expect(response.status).toBe(400);
  });
});

describe('account password', () => {
  it('asks for the current password before changing it', async () => {
    const { browser } = await signedUpBrowser(harness);
    const missing = await browser.post('/auth/password', { newPassword: 'another password' });
    expect(await missing.json()).toEqual({ error: 'current_password_required' });
    const wrong = await browser.post('/auth/password', {
      currentPassword: 'wrong',
      newPassword: 'another password',
    });
    expect(wrong.status).toBe(401);
  });

  it('changes it and logs out other browsers but not this one', async () => {
    const { browser, email, password } = await signedUpBrowser(harness);
    const other = createBrowser(harness);
    await login(other, email, password);
    const response = await browser.post('/auth/password', {
      currentPassword: password,
      newPassword: 'changed password',
    });
    expect(response.status).toBe(200);
    expect((await browser.get('/auth/session')).status).toBe(200);
    expect((await other.get('/auth/session')).status).toBe(401);
  });
});
