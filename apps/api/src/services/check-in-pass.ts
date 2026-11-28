import { constantTimeEqual, hmacSha256 } from '../lib/crypto';
import { unprocessable } from './errors';

const VERSION = 'gx1';
/** Staff passes look alike but sign a different payload, so neither can pass for the other. */
const STAFF_VERSION = 'gs1';
/** Long enough to survive a slow refresh, short enough that a screenshot sent to a friend is useless. */
export const CHECK_IN_PASS_TTL_SECONDS = 120;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// The box is signed in but not written: a pass from another box simply fails the check.
function signedPayload(version: string, boxId: string, subjectId: string, expiresAt: number) {
  return `check-in-pass:${version}:${boxId}:${subjectId}:${expiresAt}`;
}

async function signPass(
  version: string,
  secret: string,
  boxId: string,
  subjectId: string,
  now: Date,
) {
  const expiresAt = Math.floor(now.getTime() / 1000) + CHECK_IN_PASS_TTL_SECONDS;
  const signature = await hmacSha256(secret, signedPayload(version, boxId, subjectId, expiresAt));
  return {
    pass: [version, subjectId, expiresAt.toString(36), signature].join('.'),
    expiresAt: new Date(expiresAt * 1000),
  };
}

async function verifyPass(
  version: string,
  secret: string,
  boxId: string,
  pass: string,
  now: Date,
): Promise<string> {
  const [found, subjectId, expiry, signature, ...rest] = pass.split('.');
  if (found !== version || !subjectId || !expiry || !signature || rest.length > 0) {
    throw unprocessable('check_in_pass_invalid');
  }
  if (!UUID_PATTERN.test(subjectId) || !/^[0-9a-z]{1,10}$/.test(expiry)) {
    throw unprocessable('check_in_pass_invalid');
  }
  const expiresAt = parseInt(expiry, 36);
  const expected = await hmacSha256(secret, signedPayload(version, boxId, subjectId, expiresAt));
  if (!constantTimeEqual(signature, expected)) throw unprocessable('check_in_pass_invalid');
  // Checked after the signature, so "expired" never confirms a guessed pass was close.
  if (expiresAt * 1000 <= now.getTime()) throw unprocessable('check_in_pass_expired');
  return subjectId;
}

/**
 * A pass is `gx1.<memberId>.<expiry in seconds>.<HMAC>`: stateless, so issuing
 * one writes nothing and the entrance only needs the API to check it.
 */
export function signCheckInPass(
  secret: string,
  boxId: string,
  memberId: string,
  now: Date,
): Promise<{ pass: string; expiresAt: Date }> {
  return signPass(VERSION, secret, boxId, memberId, now);
}

/** The member id inside a valid pass for this box. Any doubt is `check_in_pass_invalid`. */
export function verifyCheckInPass(
  secret: string,
  boxId: string,
  pass: string,
  now: Date,
): Promise<string> {
  return verifyPass(VERSION, secret, boxId, pass, now);
}

/** A coach's or front desk's own pass, `gs1.<userId>.<expiry>.<HMAC>`, for their arrival. */
export function signStaffPass(secret: string, boxId: string, userId: string, now: Date) {
  return signPass(STAFF_VERSION, secret, boxId, userId, now);
}

export function verifyStaffPass(secret: string, boxId: string, pass: string, now: Date) {
  return verifyPass(STAFF_VERSION, secret, boxId, pass, now);
}

export function isStaffPass(pass: string): boolean {
  return pass.startsWith(`${STAFF_VERSION}.`);
}
