import { sql } from 'drizzle-orm';
import { pgPolicy, pgRole } from 'drizzle-orm/pg-core';

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

/** For tables only `withSystemScope` may touch (login data, AI keys); grants are revoked too. */
export const denyAppRole = () =>
  pgPolicy('deny_app_role', { for: 'all', to: appRole, using: sql`false`, withCheck: sql`false` });
