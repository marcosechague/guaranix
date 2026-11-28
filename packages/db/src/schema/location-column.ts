import { sql } from 'drizzle-orm';
import { uuid } from 'drizzle-orm/pg-core';

/**
 * `location_id` of schedules and classes. NOT NULL in the database, but optional on
 * insert: when it is left out, a BEFORE INSERT trigger (migration 0018) fills in the
 * schedule's location or the box's default one. That keeps single-location boxes,
 * seeds and code written before multi-location working unchanged. Services that know
 * the location should still pass it.
 */
export const locationColumn = () =>
  uuid()
    .notNull()
    .default(sql`null`);
