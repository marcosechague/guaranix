import { sql } from 'drizzle-orm';
import { index, jsonb, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { primaryId } from './columns';
import { boxes, users } from './platform';
import { appRole, currentBoxId } from './rls';

/**
 * Append-only record of who changed prices, plans, payments, permissions or
 * member data. `box_id` is null for platform-level events. The app role may
 * only insert and read its own box's entries (no UPDATE/DELETE grant).
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: primaryId(),
    boxId: uuid().references(() => boxes.id),
    actorUserId: uuid().references(() => users.id),
    impersonatorUserId: uuid().references(() => users.id),
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: uuid(),
    changes: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_logs_box_id_created_at_idx').on(table.boxId, table.createdAt),
    index('audit_logs_entity_idx').on(table.entityType, table.entityId),
    pgPolicy('audit_logs_select_own_box', {
      for: 'select',
      to: appRole,
      using: sql`${table.boxId} = ${currentBoxId}`,
    }),
    pgPolicy('audit_logs_insert_own_box', {
      for: 'insert',
      to: appRole,
      withCheck: sql`${table.boxId} = ${currentBoxId}`,
    }),
  ],
);
