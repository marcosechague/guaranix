import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';
import { readDatabaseUrl } from './src/database-url.ts';

// CI has no .env file; it passes DATABASE_URL through the environment instead.
if (existsSync('../../.env')) process.loadEnvFile('../../.env');

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  dbCredentials: { url: readDatabaseUrl(process.env) },
  casing: 'snake_case',
  strict: true,
  verbose: true,
});
