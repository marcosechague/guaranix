import { and, asc, count, desc, eq, gte, isNull, or } from 'drizzle-orm';
import { classSchedules, locations } from '@guaranix/db/schema';
import type { CreateLocationInput, UpdateLocationInput } from '@guaranix/shared/schemas';
import { diff, recordAudit } from './audit';
import { boxToday, currentBox } from './box-calendar';
import { MANAGER_ROLES, assertRole, isStaff, type ServiceContext } from './context';
import { conflict, isUniqueViolation, notFound, unprocessable } from './errors';
import { definedFields } from './objects';

export type LocationRow = typeof locations.$inferSelect;

function translateUniqueViolation(error: unknown): never {
  if (isUniqueViolation(error)) throw conflict('location_name_taken');
  throw error;
}

/** Default first, then by name. Members only see open locations. */
export async function listLocations(context: ServiceContext): Promise<LocationRow[]> {
  const query = context.transaction
    .select()
    .from(locations)
    .orderBy(desc(locations.isDefault), asc(locations.name));
  return isStaff(context.auth.role) ? query : query.where(eq(locations.isActive, true));
}

export async function getLocation(
  context: ServiceContext,
  locationId: string,
): Promise<LocationRow> {
  const [location] = await context.transaction
    .select()
    .from(locations)
    .where(eq(locations.id, locationId));
  if (!location) throw notFound('location');
  return location;
}

export async function defaultLocation(context: ServiceContext): Promise<LocationRow> {
  const [location] = await context.transaction
    .select()
    .from(locations)
    .where(eq(locations.isDefault, true));
  if (!location) throw notFound('location');
  return location;
}

/** The location a new schedule goes to: the one asked for, if open, or the default. */
export async function resolveLocationId(
  context: ServiceContext,
  locationId: string | undefined,
): Promise<string> {
  if (locationId === undefined) return (await defaultLocation(context)).id;
  const location = await getLocation(context, locationId);
  if (!location.isActive) throw unprocessable('location_inactive');
  return location.id;
}

/** RLS hides other boxes' locations, so an id from another box is "not found" too. */
export async function assertLocationsExist(context: ServiceContext, locationIds: string[]) {
  if (locationIds.length === 0) return;
  const known = await context.transaction.select({ id: locations.id }).from(locations);
  const knownIds = new Set(known.map((location) => location.id));
  if (locationIds.some((id) => !knownIds.has(id))) throw notFound('location');
}

/** A box pays for every location beyond the first (`extra_locations`, set by GuaraniX). */
async function assertRoomForAnotherLocation(context: ServiceContext) {
  const box = await currentBox(context);
  const [row] = await context.transaction
    .select({ open: count() })
    .from(locations)
    .where(eq(locations.isActive, true));
  if ((row?.open ?? 0) >= 1 + box.extraLocations) throw unprocessable('location_limit_reached');
}

/** Weekly slots still running at a location; closing it would orphan their future classes. */
async function hasRunningSchedules(context: ServiceContext, locationId: string) {
  const today = await boxToday(context);
  const [row] = await context.transaction
    .select({ running: count() })
    .from(classSchedules)
    .where(
      and(
        eq(classSchedules.locationId, locationId),
        or(isNull(classSchedules.validUntil), gte(classSchedules.validUntil, today)),
      ),
    );
  return (row?.running ?? 0) > 0;
}

export async function createLocation(
  context: ServiceContext,
  input: CreateLocationInput,
): Promise<LocationRow> {
  assertRole(context.auth.role, MANAGER_ROLES);
  await assertRoomForAnotherLocation(context);
  const [location] = await context.transaction
    .insert(locations)
    .values({ ...input, boxId: context.auth.boxId })
    .returning()
    .catch(translateUniqueViolation);
  if (!location) throw new Error('Location insert returned no row');
  await recordAudit(context, {
    action: 'location.created',
    entityType: 'location',
    entityId: location.id,
  });
  return location;
}

async function assertStatusChangeAllowed(
  context: ServiceContext,
  before: LocationRow,
  isActive: boolean | undefined,
) {
  if (isActive === undefined || isActive === before.isActive) return;
  if (isActive) return assertRoomForAnotherLocation(context);
  if (before.isDefault) throw unprocessable('default_location_required');
  if (await hasRunningSchedules(context, before.id)) throw unprocessable('location_has_schedules');
}

/** Moves the default: only one row may have it, so the old one is cleared first. */
async function makeDefault(context: ServiceContext, location: LocationRow) {
  if (!location.isActive) throw unprocessable('location_inactive');
  await context.transaction
    .update(locations)
    .set({ isDefault: false })
    .where(eq(locations.isDefault, true));
}

export async function updateLocation(
  context: ServiceContext,
  locationId: string,
  input: UpdateLocationInput,
): Promise<LocationRow> {
  assertRole(context.auth.role, MANAGER_ROLES);
  const before = await getLocation(context, locationId);
  const fields = definedFields(input);
  if (Object.keys(fields).length === 0) return before;
  await assertStatusChangeAllowed(context, before, fields.isActive);
  if (fields.isDefault && !before.isDefault) {
    await makeDefault(context, { ...before, isActive: fields.isActive ?? before.isActive });
  }
  const [location] = await context.transaction
    .update(locations)
    .set(fields)
    .where(eq(locations.id, locationId))
    .returning()
    .catch(translateUniqueViolation);
  if (!location) throw notFound('location');
  await recordAudit(context, {
    action: 'location.updated',
    entityType: 'location',
    entityId: location.id,
    changes: diff(before, fields),
  });
  return location;
}
