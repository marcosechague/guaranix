import { index, jsonb, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { importSourceEnum } from './enums';
import { users } from './platform';
import { tenantColumns, tenantIsolationPolicy, tenantKey } from './tenant';

/**
 * One committed migration from a spreadsheet, CrossHero or an AI-read file.
 * Members, plans, member plans and charges it created point back to it with
 * `import_id`. Append-only for the app role, like the audit log.
 */
export const dataImports = pgTable(
  'data_imports',
  {
    ...tenantColumns(),
    createdByUserId: uuid().references(() => users.id),
    fileName: text().notNull(),
    source: importSourceEnum().notNull(),
    /** SHA-256 of the mapped rows: committing the same rows twice returns the first import. */
    payloadHash: text().notNull(),
    /** Counts of what was created; see `ImportSummary` in packages/shared. */
    summary: jsonb().notNull(),
  },
  (table) => [
    tenantKey('data_imports', table.boxId, table.id),
    unique('data_imports_box_id_payload_hash_unique').on(table.boxId, table.payloadHash),
    index('data_imports_box_id_created_at_idx').on(table.boxId, table.createdAt),
    tenantIsolationPolicy(table.boxId),
  ],
);
