import { describe, expect, it } from 'vitest';
import { openSecret, sealSecret, secretHint } from '../secret-box';

const masterKey = btoa(String.fromCharCode(...new Uint8Array(32).map((_, index) => index)));
const otherKey = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
const apiKey = 'sk-ant-api03-very-secret-value-9f3a'; // secret-scan-ignore: fake key for tests

describe('secret box', () => {
  it('round-trips a key without keeping it readable', async () => {
    const sealed = await sealSecret(masterKey, apiKey, 'anthropic');
    expect(sealed).not.toContain(apiKey);
    expect(atob(sealed)).not.toContain('very-secret');
    expect(await openSecret(masterKey, sealed, 'anthropic')).toBe(apiKey);
  });

  it('uses a fresh nonce every time', async () => {
    const first = await sealSecret(masterKey, apiKey, 'anthropic');
    const second = await sealSecret(masterKey, apiKey, 'anthropic');
    expect(first).not.toBe(second);
  });

  it('refuses another master key or a ciphertext moved to another provider', async () => {
    const sealed = await sealSecret(masterKey, apiKey, 'anthropic');
    await expect(openSecret(otherKey, sealed, 'anthropic')).rejects.toThrow();
    await expect(openSecret(masterKey, sealed, 'openai')).rejects.toThrow();
  });

  it('rejects a master key of the wrong size', async () => {
    await expect(sealSecret(btoa('short'), apiKey, 'anthropic')).rejects.toThrow(/32 bytes/);
  });

  it('shows only the last four characters', () => {
    expect(secretHint(` ${apiKey} `)).toBe('9f3a');
  });
});
