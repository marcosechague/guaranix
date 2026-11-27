import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type * as schema from './schema';

type Schema = typeof schema;

/** Any Drizzle Postgres database built with this schema (postgres-js in prod, PGlite in tests). */
export type SchemaDatabase = PgDatabase<PgQueryResultHKT, Schema>;
export type ScopedTransaction = PgTransaction<
  PgQueryResultHKT,
  Schema,
  ExtractTablesWithRelations<Schema>
>;

export interface BoxScope {
  boxId: string;
  /** Signed-in user, so they can read and rename their own account. */
  userId?: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: string, label: string): void {
  if (!UUID.test(value)) throw new TypeError(`${label} must be a UUID`);
}

/**
 * Runs `work` in a transaction that can only see and write rows of one box.
 * Postgres enforces it with Row Level Security: the transaction switches to the
 * `guaranix_app` role, and every policy compares `box_id` with `app.box_id`.
 * Both settings are `LOCAL`, so they end with the transaction and never leak
 * to the next request sharing the pooled connection.
 */
export async function withBoxScope<T>(
  database: SchemaDatabase,
  scope: BoxScope,
  work: (transaction: ScopedTransaction) => Promise<T>,
): Promise<T> {
  assertUuid(scope.boxId, 'boxId');
  if (scope.userId) assertUuid(scope.userId, 'userId');
  return database.transaction(async (transaction) => {
    await transaction.execute(
      sql`select set_config('app.box_id', ${scope.boxId}, true), set_config('app.user_id', ${scope.userId ?? ''}, true)`,
    );
    await transaction.execute(sql`set local role guaranix_app`);
    return work(transaction);
  });
}

/**
 * Runs `work` without tenant restrictions, for platform admin tools, login,
 * cron jobs and seeds. Callers must authorize first and write to `audit_logs`
 * when acting on a box's data.
 */
export async function withSystemScope<T>(
  database: SchemaDatabase,
  work: (transaction: ScopedTransaction) => Promise<T>,
): Promise<T> {
  return database.transaction(work);
}
