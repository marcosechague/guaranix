import { sql } from 'drizzle-orm';
import { check, date, index, jsonb, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { brodiMessageRoleEnum, brodiSummarySourceEnum } from './enums';
import { users } from './platform';
import { tenantColumns, tenantIsolationPolicy } from './tenant';

/** Longest question or answer kept (same as the check below); the API enforces a shorter limit on questions. */
export const BRODI_MESSAGE_MAX_LENGTH = 4000;

/**
 * One line of a staff member's conversation with Brodi. Each person sees only
 * their own lines (filtered by `user_id` in the service), inside their box (RLS).
 */
export const brodiMessages = pgTable(
  'brodi_messages',
  {
    ...tenantColumns(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    role: brodiMessageRoleEnum().notNull(),
    content: text().notNull(),
  },
  (table) => [
    index('brodi_messages_box_id_user_id_created_at_idx').on(
      table.boxId,
      table.userId,
      table.createdAt,
    ),
    check('brodi_messages_content_length', sql`char_length(${table.content}) between 1 and 4000`),
    tenantIsolationPolicy(table.boxId),
  ],
);

/**
 * The Monday summary of the week before, one per box and week. `figures` keeps
 * the numbers it was written from, so the panel can show them next to the text.
 */
export const brodiWeeklySummaries = pgTable(
  'brodi_weekly_summaries',
  {
    ...tenantColumns(),
    /** Monday of the summarized week, box-local. */
    weekStart: date().notNull(),
    source: brodiSummarySourceEnum().notNull(),
    summary: text().notNull(),
    figures: jsonb().notNull(),
  },
  (table) => [
    unique('brodi_weekly_summaries_box_id_week_start_unique').on(table.boxId, table.weekStart),
    tenantIsolationPolicy(table.boxId),
  ],
);
