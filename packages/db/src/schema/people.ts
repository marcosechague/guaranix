import { boolean, date, index, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { boxRoleEnum, memberStatusEnum } from './enums';
import { dataImports } from './imports';
import { locations } from './locations';
import { users } from './platform';
import { sameBoxReference, tenantColumns, tenantIsolationPolicy, tenantKey } from './tenant';

/** A user's role inside one box. One role per person per box. */
export const boxUsers = pgTable(
  'box_users',
  {
    ...tenantColumns(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    role: boxRoleEnum().notNull(),
    isActive: boolean().notNull().default(true),
  },
  (table) => [
    tenantKey('box_users', table.boxId, table.id),
    unique('box_users_box_id_user_id_unique').on(table.boxId, table.userId),
    index('box_users_user_id_idx').on(table.userId),
    tenantIsolationPolicy(table.boxId),
  ],
);

/**
 * A member's profile in a box. `user_id` is empty until the member logs in for
 * the first time, so imported members (Excel, CrossHero) can exist without an account.
 */
export const members = pgTable(
  'members',
  {
    ...tenantColumns(),
    userId: uuid(),
    firstName: text().notNull(),
    lastName: text().notNull(),
    documentNumber: text(),
    email: text(),
    phone: text(),
    birthDate: date(),
    emergencyContactName: text(),
    emergencyContactPhone: text(),
    medicalNotes: text(),
    notes: text(),
    status: memberStatusEnum().notNull().default('active'),
    joinedOn: date()
      .notNull()
      .default(sql`current_date`),
    /** Id in the system the member was imported from. */
    externalRef: text(),
    /** The import that created this row, if any. */
    importId: uuid(),
    /** Location the member usually trains at, for per-location reports. Null means the default. */
    homeLocationId: uuid(),
  },
  (table) => [
    tenantKey('members', table.boxId, table.id),
    unique('members_box_id_user_id_unique').on(table.boxId, table.userId),
    unique('members_box_id_document_number_unique').on(table.boxId, table.documentNumber),
    index('members_box_id_last_name_idx').on(table.boxId, table.lastName),
    sameBoxReference(
      'members_box_user_fk',
      [table.boxId, table.userId],
      [boxUsers.boxId, boxUsers.userId],
    ),
    sameBoxReference(
      'members_import_fk',
      [table.boxId, table.importId],
      [dataImports.boxId, dataImports.id],
    ),
    sameBoxReference(
      'members_home_location_fk',
      [table.boxId, table.homeLocationId],
      [locations.boxId, locations.id],
    ),
    tenantIsolationPolicy(table.boxId),
  ],
);
