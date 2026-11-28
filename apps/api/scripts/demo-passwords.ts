/**
 * Gives the seeded demo accounts a known password, for local development only.
 * Lives in the API because the hash uses the API's pepper (AUTH_SECRET), so the
 * same algorithm and secret verify it at login.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inArray } from 'drizzle-orm';
import { createDatabase, withSystemScope } from '@guaranix/db';
import { userCredentials, users } from '@guaranix/db/schema';
import { hashPassword } from '../src/lib/password';

export const DEMO_PASSWORD = 'guaranix-demo-2026';
const DEMO_EMAILS = [
  'admin@guaranix.local',
  'owner@box-demo-asuncion.local',
  'coach@box-demo-asuncion.local',
  'recepcion@box-demo-asuncion.local',
  'alumno@box-demo-asuncion.local',
];
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** `wrangler dev` reads `.dev.vars`; reading it here keeps one local secret. */
function devVars(): Record<string, string> {
  try {
    // pnpm runs package scripts from apps/api.
    const text = readFileSync(resolve(process.cwd(), '.dev.vars'), { encoding: 'utf8' });
    return Object.fromEntries(
      text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
    );
  } catch {
    return {};
  }
}

const vars = { ...devVars(), ...process.env };
const databaseUrl = vars.DATABASE_URL;
const pepper = vars.AUTH_SECRET;
if (!databaseUrl || !pepper) {
  throw new Error('DATABASE_URL and AUTH_SECRET are needed (copy apps/api/.dev.vars.example).');
}
// A known password must never reach a shared database.
if (process.env.NODE_ENV === 'production' || !LOCAL_HOSTS.has(new URL(databaseUrl).hostname)) {
  throw new Error('Demo passwords are only set on a local development database.');
}

const database = createDatabase(databaseUrl);
try {
  const demoUsers = await withSystemScope(database, async (transaction) => {
    const rows = await transaction
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.email, DEMO_EMAILS));
    for (const row of rows) {
      const passwordHash = await hashPassword(DEMO_PASSWORD, pepper);
      await transaction
        .insert(userCredentials)
        .values({ userId: row.id, passwordHash })
        .onConflictDoUpdate({ target: userCredentials.userId, set: { passwordHash } });
    }
    return rows;
  });
  console.log(`Demo password set for ${demoUsers.length} accounts.`);
} finally {
  await database.$client.end();
}
