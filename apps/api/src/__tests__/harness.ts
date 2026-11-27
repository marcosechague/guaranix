import { createMemoryEmailSender } from '@guaranix/messaging';
import { createTestDatabase, seedDemoBox, seedPlatform } from '@guaranix/db/testing';
import type { Session } from '@guaranix/shared';
import { createApp } from '../app';
import type { Bindings, Services } from '../env';
import type { GoogleIdentity, GoogleOAuth } from '../integrations/google-oauth';

export const APP_ORIGIN = 'http://localhost:5173';

export const testEnv: Bindings = {
  APP_ENV: 'development',
  ALLOWED_ORIGINS: `${APP_ORIGIN},http://localhost:5174`,
  PUBLIC_API_URL: 'http://localhost:8787',
  AUTH_SECRET: 'test-secret-that-is-long-enough-for-hmac-keys',
  TURNSTILE_SITE_KEY: 'site-key',
};

export interface FakeGoogle extends GoogleOAuth {
  /** Identity the next code exchange returns; `nonce` is filled from the request. */
  nextIdentity: Omit<GoogleIdentity, 'nonce'> | null;
}

function createFakeGoogle(): FakeGoogle {
  let lastNonce: string | null = null;
  const google: FakeGoogle = {
    nextIdentity: null,
    authorizationUrl(request) {
      lastNonce = request.nonce;
      const params = new URLSearchParams({ state: request.state, nonce: request.nonce });
      return `https://accounts.google.test/auth?${params.toString()}`;
    },
    async exchangeCode() {
      return google.nextIdentity ? { ...google.nextIdentity, nonce: lastNonce } : null;
    },
  };
  return google;
}

/** One in-memory database and app per test file, with fake integrations. */
export async function createHarness() {
  const testDatabase = await createTestDatabase();
  const platform = await seedPlatform(testDatabase.database);
  const boxA = await seedDemoBox(testDatabase.database, { slug: 'box-a', days: 1 });
  const boxB = await seedDemoBox(testDatabase.database, { slug: 'box-b', days: 1 });
  const emails = createMemoryEmailSender();
  const google = createFakeGoogle();
  const captcha = { enabled: true, passes: true };

  const services: Services = {
    database: () => testDatabase.database,
    emailSender: emails,
    get captcha() {
      return captcha.enabled ? { verify: async () => captcha.passes } : null;
    },
    get google() {
      return google;
    },
  };
  const app = createApp({ services: () => services });

  return {
    app,
    database: testDatabase.database,
    platform,
    boxA,
    boxB,
    emails,
    google,
    captcha,
    close: testDatabase.close,
  };
}

export type Harness = Awaited<ReturnType<typeof createHarness>>;

let ipCounter = 0;

/** A browser: keeps cookies and the CSRF token between requests. */
export function createBrowser(harness: Harness, origin = APP_ORIGIN) {
  const cookies = new Map<string, string>();
  let csrfToken: string | null = null;
  const ip = `10.0.0.${(ipCounter += 1)}`;

  async function request(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    const allHeaders: Record<string, string> = { 'cf-connecting-ip': ip, ...headers };
    if (method !== 'GET') allHeaders['origin'] ??= origin;
    if (method !== 'GET' && csrfToken) allHeaders['x-csrf-token'] ??= csrfToken;
    if (body !== undefined) allHeaders['content-type'] = 'application/json';
    if (cookies.size > 0) {
      allHeaders['cookie'] = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    }
    const response = await harness.app.request(
      path,
      {
        method,
        headers: allHeaders,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
      testEnv,
    );
    for (const header of response.headers.getSetCookie()) {
      const [pair, ...attributes] = header.split(';');
      const [name, ...rest] = (pair ?? '').split('=');
      const value = rest.join('=');
      const expired = attributes.some((attribute) => /max-age=0/i.test(attribute.trim()));
      if (!name) continue;
      if (expired || value === '') cookies.delete(name.trim());
      else cookies.set(name.trim(), value);
    }
    if (response.headers.get('content-type')?.includes('application/json')) {
      const json = (await response.clone().json()) as Partial<Session>;
      if (typeof json.csrfToken === 'string') csrfToken = json.csrfToken;
    }
    return response;
  }

  return {
    cookies,
    get csrfToken() {
      return csrfToken;
    },
    set csrfToken(value: string | null) {
      csrfToken = value;
    },
    get: (path: string, headers?: Record<string, string>) =>
      request('GET', path, undefined, headers),
    post: (path: string, body?: unknown, headers?: Record<string, string>) =>
      request('POST', path, body, headers),
    patch: (path: string, body?: unknown, headers?: Record<string, string>) =>
      request('PATCH', path, body, headers),
    delete: (path: string, headers?: Record<string, string>) =>
      request('DELETE', path, undefined, headers),
  };
}

export type Browser = ReturnType<typeof createBrowser>;

let emailCounter = 0;

export function uniqueEmail(prefix = 'user') {
  return `${prefix}-${(emailCounter += 1)}@example.com`;
}

/** Signs up a fresh user and returns their logged-in browser. */
export async function signedUpBrowser(harness: Harness, password = 'correct horse battery') {
  const browser = createBrowser(harness);
  const email = uniqueEmail();
  const response = await browser.post('/auth/signup', {
    fullName: 'Ana Benítez',
    email,
    password,
    captchaToken: 'ok',
  });
  if (response.status !== 200) throw new Error(`Signup failed with ${response.status}`);
  const session = (await response.json()) as Session;
  return { browser, email, password, session };
}
