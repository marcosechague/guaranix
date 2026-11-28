import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBrowser, createHarness, type Harness, signedUpBrowser } from './__tests__/harness';

let harness: Harness;

beforeAll(async () => {
  harness = await createHarness();
});

afterAll(async () => {
  await harness.close();
});

describe('API app', () => {
  it('reports health without a session', async () => {
    const response = await createBrowser(harness).get('/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', environment: 'development' });
  });

  it('sets secure headers', async () => {
    const response = await createBrowser(harness).get('/health');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('refuses oversized bodies before parsing them, even on public routes', async () => {
    const response = await createBrowser(harness).post('/auth/login', {
      email: 'ana@example.com',
      password: 'x'.repeat(200 * 1024),
      captchaToken: 'ok',
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'payload_too_large' });
  });

  it('denies unknown routes to anonymous callers before revealing they do not exist', async () => {
    const response = await createBrowser(harness).get('/nope');
    expect(response.status).toBe(401);
  });

  it('returns a JSON 404 for unknown routes once logged in', async () => {
    const { browser } = await signedUpBrowser(harness);
    const response = await browser.get('/nope');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
  });

  it('answers CORS preflights only for our apps', async () => {
    const preflight = (origin: string) =>
      harness.app.request(
        '/auth/login',
        {
          method: 'OPTIONS',
          headers: { origin, 'access-control-request-method': 'POST' },
        },
        {
          APP_ENV: 'development',
          ALLOWED_ORIGINS: 'http://localhost:5173',
          PUBLIC_API_URL: '',
          AUTH_SECRET: 'x',
        },
      );
    const ours = await preflight('http://localhost:5173');
    expect(ours.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(ours.headers.get('access-control-allow-credentials')).toBe('true');
    const theirs = await preflight('https://evil.example');
    expect(theirs.headers.get('access-control-allow-origin')).toBeNull();
  });
});
