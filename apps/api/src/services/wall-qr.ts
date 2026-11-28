import type { WallQrView } from '@guaranix/shared/schemas';
import { constantTimeEqual, hmacSha256 } from '../lib/crypto';
import { MANAGER_ROLES, assertRole, type ServiceContext } from './context';
import { unprocessable } from './errors';
import { getLocation } from './locations';

const VERSION = 'w1';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function signedPayload(boxId: string, locationId: string) {
  return `wall-qr:${VERSION}:${boxId}:${locationId}`;
}

/**
 * The poster's code, `w1.<locationId>.<HMAC>`. It never expires (it's printed),
 * so it only says which location; being there is what the phone's position proves.
 */
export async function signWallCode(
  secret: string,
  boxId: string,
  locationId: string,
): Promise<string> {
  const signature = await hmacSha256(secret, signedPayload(boxId, locationId));
  return [VERSION, locationId, signature].join('.');
}

/** The location of a poster from this box. Any doubt is `wall_qr_invalid`. */
export async function verifyWallCode(secret: string, boxId: string, code: string) {
  const [version, locationId, signature, ...rest] = code.split('.');
  if (version !== VERSION || !locationId || !signature || rest.length > 0) {
    throw unprocessable('wall_qr_invalid');
  }
  if (!UUID_PATTERN.test(locationId)) throw unprocessable('wall_qr_invalid');
  const expected = await hmacSha256(secret, signedPayload(boxId, locationId));
  if (!constantTimeEqual(signature, expected)) throw unprocessable('wall_qr_invalid');
  return locationId;
}

/** What the printable poster for a location shows. */
export async function wallQrFor(
  context: ServiceContext,
  secret: string,
  memberAppUrl: string,
  locationId: string,
): Promise<WallQrView> {
  assertRole(context.auth.role, MANAGER_ROLES);
  const location = await getLocation(context, locationId);
  const code = await signWallCode(secret, context.auth.boxId, location.id);
  return {
    url: new URL(`pared/${code}`, memberAppUrl.endsWith('/') ? memberAppUrl : `${memberAppUrl}/`)
      .href,
    locationName: location.name,
  };
}
