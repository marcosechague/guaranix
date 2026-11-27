import { describe, expect, it } from 'vitest';
import { validateIdToken } from '../integrations/google-oauth';
import { base64UrlEncode, constantTimeEqual } from '../lib/crypto';
import { hashPassword, needsRehash, verifyPassword } from '../lib/password';
import { assertProductionConfig } from '../services/runtime';
import { testEnv } from './harness';

const pepper = 'pepper-for-tests';

describe('password hashing', () => {
  it('verifies the right password only', async () => {
    const hash = await hashPassword('correct horse', pepper);
    expect(await verifyPassword('correct horse', hash, pepper)).toBe(true);
    expect(await verifyPassword('wrong horse', hash, pepper)).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same', pepper)).not.toBe(await hashPassword('same', pepper));
  });

  it('depends on the pepper, so a database dump alone cannot be cracked', async () => {
    const hash = await hashPassword('correct horse', pepper);
    expect(await verifyPassword('correct horse', hash, 'another pepper')).toBe(false);
  });

  it('rejects malformed hashes and flags weaker ones for upgrade', async () => {
    expect(await verifyPassword('x', 'garbage', pepper)).toBe(false);
    expect(needsRehash('pbkdf2-sha256$1000$salt$hash')).toBe(true);
    expect(needsRehash(await hashPassword('x', pepper))).toBe(false);
  });
});

describe('constantTimeEqual', () => {
  it('compares strings of any length', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('Google ID token', () => {
  const clientId = 'client-id.apps.googleusercontent.com';
  const token = (claims: Record<string, unknown>) =>
    `header.${base64UrlEncode(new TextEncoder().encode(JSON.stringify(claims)))}.signature`;
  const valid = {
    iss: 'https://accounts.google.com',
    aud: clientId,
    exp: 2_000_000_000,
    sub: '1234',
    email: 'Ana@Example.com',
    email_verified: true,
    name: 'Ana',
    nonce: 'n',
  };

  it('reads the identity from valid claims', () => {
    expect(validateIdToken(token(valid), clientId, 1_900_000_000)).toEqual({
      subject: '1234',
      email: 'ana@example.com',
      emailVerified: true,
      name: 'Ana',
      nonce: 'n',
    });
  });

  it.each([
    ['another audience', { aud: 'someone-else' }],
    ['another issuer', { iss: 'https://evil.example' }],
    ['an expired token', { exp: 1 }],
    ['no subject', { sub: '' }],
  ])('rejects %s', (_label, override) => {
    expect(validateIdToken(token({ ...valid, ...override }), clientId, 1_900_000_000)).toBeNull();
  });
});

describe('production configuration', () => {
  it('is optional in development', () => {
    expect(() => assertProductionConfig(testEnv)).not.toThrow();
  });

  it('fails closed in production when captcha, Google or Resend are missing', () => {
    expect(() => assertProductionConfig({ ...testEnv, APP_ENV: 'production' })).toThrow(
      /TURNSTILE_SECRET_KEY.*GOOGLE_CLIENT_ID.*RESEND_API_KEY/,
    );
  });

  it('passes in production when everything is set', () => {
    expect(() =>
      assertProductionConfig({
        ...testEnv,
        APP_ENV: 'production',
        TURNSTILE_SECRET_KEY: 's',
        GOOGLE_CLIENT_ID: 'g',
        GOOGLE_CLIENT_SECRET: 'g',
        RESEND_API_KEY: 'r',
        EMAIL_FROM: 'GuaraniX <no-responder@example.com>',
      }),
    ).not.toThrow();
  });
});
