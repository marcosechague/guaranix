import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import type { Bindings } from './env';

const env: Bindings = { APP_ENV: 'development' };

describe('API app', () => {
  it('reports health', async () => {
    const response = await createApp().request('/health', {}, env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', environment: 'development' });
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const response = await createApp().request('/nope', {}, env);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
  });

  it('sets secure headers', async () => {
    const response = await createApp().request('/health', {}, env);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
