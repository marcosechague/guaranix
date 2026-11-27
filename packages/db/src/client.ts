import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * In the Worker the connection string comes from the Hyperdrive binding
 * (`env.HYPERDRIVE.connectionString`); locally it is DATABASE_URL.
 *
 * The returned handle runs as the connection's owner role, which bypasses
 * Row Level Security. Request code must go through `withBoxScope`.
 */
export function createDatabase(connectionString: string) {
  // Hyperdrive already pools connections, so each request keeps a small client.
  const client = postgres(connectionString, { max: 5, prepare: false });
  return drizzle(client, { schema, casing: 'snake_case' });
}

export type Database = ReturnType<typeof createDatabase>;
