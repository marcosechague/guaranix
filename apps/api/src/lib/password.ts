import {
  base64UrlDecode,
  base64UrlEncode,
  constantTimeEqual,
  hmacSha256Bytes,
  randomBytes,
} from './crypto';

const ALGORITHM = 'pbkdf2-sha256';
/**
 * Cloudflare Workers' WebCrypto rejects PBKDF2 above 100,000 iterations, and
 * Argon2 or scrypt would need WebAssembly compiled at runtime, which Workers
 * forbid. The pepper (AUTH_SECRET) makes a leaked database alone useless for
 * cracking. The format stores the settings, so hashes can be upgraded later.
 */
export const PASSWORD_ITERATIONS = 100_000;
const KEY_BITS = 256;

async function derive(
  password: string,
  pepper: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
) {
  const peppered = await hmacSha256Bytes(pepper, password);
  const key = await crypto.subtle.importKey('raw', peppered, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    KEY_BITS,
  );
  return base64UrlEncode(new Uint8Array(bits));
}

export async function hashPassword(password: string, pepper: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, pepper, salt, PASSWORD_ITERATIONS);
  return [ALGORITHM, PASSWORD_ITERATIONS, base64UrlEncode(salt), hash].join('$');
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  pepper: string,
): Promise<boolean> {
  const [algorithm, iterations, salt, expected] = storedHash.split('$');
  const iterationCount = Number(iterations);
  if (algorithm !== ALGORITHM || !salt || !expected) return false;
  if (!Number.isInteger(iterationCount) || iterationCount < 1) return false;
  const actual = await derive(password, pepper, base64UrlDecode(salt), iterationCount);
  return constantTimeEqual(actual, expected);
}

/** True when the hash was made with weaker settings than today's. */
export function needsRehash(storedHash: string): boolean {
  const [algorithm, iterations] = storedHash.split('$');
  return algorithm !== ALGORITHM || Number(iterations) < PASSWORD_ITERATIONS;
}

const dummyHashes = new Map<string, Promise<string>>();

/**
 * Spends the same time as a real check when the email has no password, so
 * response time does not reveal which emails have accounts.
 */
export async function verifyAgainstDummy(password: string, pepper: string): Promise<false> {
  let dummy = dummyHashes.get(pepper);
  if (!dummy) {
    dummy = hashPassword('dummy-password-for-timing', pepper);
    dummyHashes.set(pepper, dummy);
  }
  await verifyPassword(password, await dummy, pepper);
  return false;
}
