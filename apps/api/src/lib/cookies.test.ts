import { describe, expect, it } from 'vitest';
import { oauthCookiePath } from './cookies';

describe('oauthCookiePath', () => {
  it('scopes the cookie to the callback path the browser sees', () => {
    expect(oauthCookiePath('https://guaranix.example.workers.dev/api')).toBe('/api/auth/google');
    expect(oauthCookiePath('https://guaranix.example.workers.dev/api/')).toBe('/api/auth/google');
  });

  it('uses the root path when the API has its own host', () => {
    expect(oauthCookiePath('http://localhost:8787')).toBe('/auth/google');
  });
});
