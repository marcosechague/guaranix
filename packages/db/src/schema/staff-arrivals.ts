import { date, index, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { users } from './platform';
import { tenantColumns, tenantIsolationPolicy, tenantKey } from './tenant';

/**
 * A coach or front-desk person scanned their own QR at the entrance. One row per
 * person per box day, so the box sees who arrived and when (decision 0016).
 */
export const staffArrivals = pgTable(
  'staff_arrivals',
  {
    ...tenantColumns(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    /** The box's calendar day, so "today" doesn't change with UTC midnight. */
    arrivedOn: date().notNull(),
    arrivedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    tenantKey('staff_arrivals', table.boxId, table.id),
    unique('staff_arrivals_one_per_day').on(table.boxId, table.userId, table.arrivedOn),
    index('staff_arrivals_box_day_idx').on(table.boxId, table.arrivedOn),
    tenantIsolationPolicy(table.boxId),
  ],
);
