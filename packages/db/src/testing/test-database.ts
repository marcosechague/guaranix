import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../schema';

const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), '../../migrations');

/** In-memory Postgres with every migration applied, so tests need no Docker. */
export async function createTestDatabase() {
  const client = new PGlite();
  const database = drizzle(client, { schema, casing: 'snake_case' });
  await migrate(database, { migrationsFolder });
  return { database, close: () => client.close() };
}

export { rowsOf } from '../rows';
