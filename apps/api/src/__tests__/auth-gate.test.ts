import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

const credentials = () => ({
  email: uniqueEmail(),
  password: 'whatever-password',
  captchaToken: 'ok',
});

describe('origin check', () => {
  it('rejects writes without an Origin header', async () => {
    const browser = createBrowser(harness);
    const response = await browser.post('/auth/login', credentials(), { origin: '' });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'csrf_failed' });
  });

  it('rejects writes from other sites (login CSRF)', async () => {
    const browser = createBrowser(harness, 'https://evil.example');
    const response = await browser.post('/auth/login', credentials());
    expect(response.status).toBe(403);
  });
});

describe('deny by default', () => {
  it('needs a session for private routes', async () => {
    const response = await createBrowser(harness).get('/auth/session');
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthenticated' });
  });

  it('ignores a forged session cookie and clears it', async () => {
    const browser = createBrowser(harness);
    browser.cookies.set('gx_session', 'forged-token');
    const response = await browser.get('/auth/session');
    expect(response.status).toBe(401);
    expect(browser.cookies.has('gx_session')).toBe(false);
  });
});

describe('CSRF token', () => {
  it('is required on writes with a session', async () => {
    const { browser } = await signedUpBrowser(harness);
    browser.csrfToken = null;
    const response = await browser.post('/auth/logout');
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'csrf_failed' });
  });

  it('must belong to the same session', async () => {
    const first = await signedUpBrowser(harness);
    const second = await signedUpBrowser(harness);
    first.browser.csrfToken = second.session.csrfToken;
    const response = await first.browser.post('/auth/logout');
    expect(response.status).toBe(403);
  });

  it('lets the write through when it matches', async () => {
    const { browser } = await signedUpBrowser(harness);
    expect((await browser.post('/auth/logout')).status).toBe(204);
    expect((await browser.get('/auth/session')).status).toBe(401);
  });
});

describe('session cookie', () => {
  it('is HttpOnly and SameSite=Lax', async () => {
    const browser = createBrowser(harness);
    const response = await browser.post('/auth/signup', {
      fullName: 'Ana',
      email: uniqueEmail(),
      password: 'long enough password',
      captchaToken: 'ok',
    });
    const cookie = response.headers
      .getSetCookie()
      .find((header) => header.startsWith('gx_session='));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\//);
  });
});
