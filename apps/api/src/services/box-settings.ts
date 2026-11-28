import { boxes } from '@guaranix/db/schema';
import type { BookingPolicy, CheckInModes, CheckInPolicy } from '@guaranix/shared/schemas';
import { eq } from 'drizzle-orm';
import { diff, recordAudit } from './audit';
import { currentBox } from './box-calendar';
import { MANAGER_ROLES, STAFF_ROLES, assertRole, type ServiceContext } from './context';
import { notFound, unprocessable } from './errors';

const POLICY_FIELDS = [
  'bookingOpensHoursBefore',
  'bookingClosesMinutesBefore',
  'lateCancelMinutesBefore',
  'lateCancelConsumesCredit',
  'noShowConsumesCredit',
  'waitlistAutoPromote',
] as const satisfies readonly (keyof BookingPolicy)[];

const CHECK_IN_FIELDS = [
  'checkInDeskEnabled',
  'checkInCoachEnabled',
  'checkInWallQrEnabled',
  'checkInRadiusMeters',
] as const satisfies readonly (keyof CheckInPolicy)[];

function pick<Fields extends readonly string[], Row extends Record<Fields[number], unknown>>(
  row: Row,
  fields: Fields,
): Pick<Row, Fields[number]> {
  return Object.fromEntries(fields.map((field) => [field, row[field as Fields[number]]])) as Pick<
    Row,
    Fields[number]
  >;
}

const pickPolicy = (row: BookingPolicy): BookingPolicy => pick(row, POLICY_FIELDS);
const pickCheckIn = (row: CheckInPolicy): CheckInPolicy => pick(row, CHECK_IN_FIELDS);

async function saveBoxSettings<Settings extends Record<string, unknown>>(
  context: ServiceContext,
  input: Settings,
  select: (row: typeof boxes.$inferSelect) => Settings,
  action: `${string}.${string}`,
): Promise<Settings> {
  assertRole(context.auth.role, MANAGER_ROLES);
  const before = select(await currentBox(context));
  const [updated] = await context.transaction
    .update(boxes)
    .set({ ...input, updatedAt: context.now })
    .where(eq(boxes.id, context.auth.boxId))
    .returning();
  if (!updated) throw notFound('box');
  const after = select(updated);
  await recordAudit(context, {
    action,
    entityType: 'box',
    entityId: context.auth.boxId,
    changes: diff(before, after),
  });
  return after;
}

export async function getBookingPolicy(context: ServiceContext): Promise<BookingPolicy> {
  assertRole(context.auth.role, STAFF_ROLES);
  return pickPolicy(await currentBox(context));
}

/** Changes when members may book and cancel. Only owners and admins, and always audited. */
export function updateBookingPolicy(
  context: ServiceContext,
  input: BookingPolicy,
): Promise<BookingPolicy> {
  return saveBoxSettings(context, input, pickPolicy, 'box.booking_policy_updated');
}

export async function getCheckInPolicy(context: ServiceContext): Promise<CheckInPolicy> {
  assertRole(context.auth.role, STAFF_ROLES);
  return pickCheckIn(await currentBox(context));
}

/** Turns the ways of marking attendance on or off. Owners and admins only, audited. */
export function updateCheckInPolicy(
  context: ServiceContext,
  input: CheckInPolicy,
): Promise<CheckInPolicy> {
  return saveBoxSettings(context, input, pickCheckIn, 'box.check_in_policy_updated');
}

export type CheckInMode = keyof CheckInModes;

export function checkInModesOf(row: Omit<CheckInPolicy, 'checkInRadiusMeters'>): CheckInModes {
  return {
    desk: row.checkInDeskEnabled,
    coach: row.checkInCoachEnabled,
    wallQr: row.checkInWallQrEnabled,
  };
}

/** A way of marking attendance the box turned off answers the same for every role. */
export async function assertCheckInModeEnabled(context: ServiceContext, mode: CheckInMode) {
  if (!checkInModesOf(await currentBox(context))[mode]) {
    throw unprocessable('check_in_mode_disabled');
  }
}
