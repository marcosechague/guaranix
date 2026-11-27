import { sql } from 'drizzle-orm';
import { foreignKey, pgPolicy, unique, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './columns';
import { boxes } from './platform';
import { appRole, currentBoxId } from './rls';

/** Columns every tenant table starts with. */
export const tenantColumns = () => ({
  id: primaryId(),
  boxId: uuid()
    .notNull()
    .references(() => boxes.id),
  ...timestamps(),
});

/** Rows are visible and writable only inside their own box's scope. */
export function tenantIsolationPolicy(boxIdColumn: AnyPgColumn) {
  return pgPolicy('tenant_isolation', {
    for: 'all',
    to: appRole,
    using: sql`${boxIdColumn} = ${currentBoxId}`,
    withCheck: sql`${boxIdColumn} = ${currentBoxId}`,
  });
}

/** `(box_id, id)` target that composite foreign keys point to. */
export function tenantKey(tableName: string, boxIdColumn: AnyPgColumn, idColumn: AnyPgColumn) {
  return unique(`${tableName}_box_id_id_unique`).on(boxIdColumn, idColumn);
}

/**
 * Foreign key that includes `box_id` on both sides, so a row can never point
 * at a row of another box, even through a bug or a forged id.
 */
export function sameBoxReference(
  name: string,
  columns: [AnyPgColumn, AnyPgColumn],
  foreignColumns: [AnyPgColumn, AnyPgColumn],
) {
  return foreignKey({ name, columns, foreignColumns });
}
