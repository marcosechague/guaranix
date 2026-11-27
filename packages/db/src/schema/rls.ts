import { sql } from 'drizzle-orm';
import { pgRole } from 'drizzle-orm/pg-core';

/**
 * Role every box-scoped request runs as (`SET LOCAL ROLE`, see `withBoxScope`).
 * It does not own the tables, so Row Level Security always applies to it.
 * Created and granted in the hand-written migrations, hence `.existing()`.
 */
export const appRole = pgRole('guaranix_app').existing();

/** Box of the current transaction; NULL when unset, which matches no row. */
export const currentBoxId = sql`nullif(current_setting('app.box_id', true), '')::uuid`;

/** Signed-in user of the current transaction, if any. */
export const currentUserId = sql`nullif(current_setting('app.user_id', true), '')::uuid`;
