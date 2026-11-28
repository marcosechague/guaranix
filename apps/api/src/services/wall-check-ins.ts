import { distanceMeters } from '@guaranix/shared';
import type { CheckInResult, WallCheckInInput } from '@guaranix/shared/schemas';
import { currentBox } from './box-calendar';
import { assertCheckInModeEnabled } from './box-settings';
import { checkInMember } from './check-ins';
import { assertRole, type ServiceContext } from './context';
import { unprocessable } from './errors';
import { getLocation } from './locations';
import { getOwnMember } from './members';
import { verifyWallCode } from './wall-qr';

/**
 * The member read the poster on the wall with their phone. It counts only if
 * the phone says it is within the box's radius of that location, and only
 * while a class there is open for check-in; then the usual rules apply.
 * A photo of the poster sent to someone at home fails on the distance.
 */
export async function checkInAtWall(
  context: ServiceContext,
  secret: string,
  input: WallCheckInInput,
): Promise<CheckInResult> {
  assertRole(context.auth.role, ['member']);
  await assertCheckInModeEnabled(context, 'wallQr');
  const locationId = await verifyWallCode(secret, context.auth.boxId, input.code);
  const location = await getLocation(context, locationId);
  if (!location.isActive || location.latitude === null || location.longitude === null) {
    throw unprocessable('wall_qr_location_missing');
  }
  const { checkInRadiusMeters: radius } = await currentBox(context);
  // A fix vaguer than the radius can't tell inside from across the street.
  if (input.accuracyMeters > radius) throw unprocessable('wall_qr_inaccurate');
  const distance = distanceMeters(input, {
    latitude: location.latitude,
    longitude: location.longitude,
  });
  if (distance > radius) throw unprocessable('wall_qr_too_far');
  return checkInMember(context, await getOwnMember(context), location.id);
}
