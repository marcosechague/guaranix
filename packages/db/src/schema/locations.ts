import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
  pgTable,
  text,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenantColumns, tenantIsolationPolicy, tenantKey } from './tenant';

/**
 * A physical site of a box. Locations live inside the box's tenant: they share its
 * members, plans and staff, and isolation between boxes stays on `box_id`.
 * Every box has exactly one default location, created with the box (migration 0018).
 */
export const locations = pgTable(
  'locations',
  {
    ...tenantColumns(),
    name: text().notNull(),
    address: text(),
    city: text(),
    phone: text(),
    /** Where the wall QR checks the member's phone against; set by staff standing there. */
    latitude: doublePrecision(),
    longitude: doublePrecision(),
    isDefault: boolean().notNull().default(false),
    isActive: boolean().notNull().default(true),
  },
  (table) => [
    tenantKey('locations', table.boxId, table.id),
    unique('locations_box_id_name_unique').on(table.boxId, table.name),
    uniqueIndex('locations_one_default_per_box')
      .on(table.boxId)
      .where(sql`${table.isDefault}`),
    // The default is where classes go when nobody picks a location, so it must stay open.
    check('locations_default_is_active', sql`not ${table.isDefault} or ${table.isActive}`),
    check(
      'locations_coordinates_valid',
      sql`(${table.latitude} is null and ${table.longitude} is null) or (${table.latitude} between -90 and 90 and ${table.longitude} between -180 and 180)`,
    ),
    tenantIsolationPolicy(table.boxId),
  ],
);
