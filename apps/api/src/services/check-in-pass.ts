import { constantTimeEqual, hmacSha256 } from '../lib/crypto';
import { unprocessable } from './errors';

const VERSION = 'gx1';
/** Long enough to survive a slow refresh, short enough that a screenshot sent to a friend is useless. */
export const CHECK_IN_PASS_TTL_SECONDS = 120;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// The box is signed in but not written: a pass from another box simply fails the check.
function signedPayload(boxId: string, memberId: string, expiresAt: number) {
  return `check-in-pass:${VERSION}:${boxId}:${memberId}:${expiresAt}`;
}

/**
 * A pass is `gx1.<memberId>.<expiry in seconds>.<HMAC>`: stateless, so issuing
 * one writes nothing and the entrance only needs the API to check it.
 */
export async function signCheckInPass(
  secret: string,
  boxId: string,
  memberId: string,
  now: Date,
): Promise<{ pass: string; expiresAt: Date }> {
  const expiresAt = Math.floor(now.getTime() / 1000) + CHECK_IN_PASS_TTL_SECONDS;
  const signature = await hmacSha256(secret, signedPayload(boxId, memberId, expiresAt));
  return {
    pass: [VERSION, memberId, expiresAt.toString(36), signature].join('.'),
    expiresAt: new Date(expiresAt * 1000),
  };
}

/** The member id inside a valid pass for this box. Any doubt is `check_in_pass_invalid`. */
export async function verifyCheckInPass(
  secret: string,
  boxId: string,
  pass: string,
  now: Date,
): Promise<string> {
  const [version, memberId, expiry, signature, ...rest] = pass.split('.');
  if (version !== VERSION || !memberId || !expiry || !signature || rest.length > 0) {
    throw unprocessable('check_in_pass_invalid');
  }
  if (!UUID_PATTERN.test(memberId) || !/^[0-9a-z]{1,10}$/.test(expiry)) {
    throw unprocessable('check_in_pass_invalid');
  }
  const expiresAt = parseInt(expiry, 36);
  const expected = await hmacSha256(secret, signedPayload(boxId, memberId, expiresAt));
  if (!constantTimeEqual(signature, expected)) throw unprocessable('check_in_pass_invalid');
  // Checked after the signature, so "expired" never confirms a guessed pass was close.
  if (expiresAt * 1000 <= now.getTime()) throw unprocessable('check_in_pass_expired');
  return memberId;
}
