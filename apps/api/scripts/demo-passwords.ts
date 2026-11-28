/**
 * Gives the seeded demo accounts a known password, for local development only.
 * Lives in the API because the hash uses the API's pepper (AUTH_SECRET), so the
 * same algorithm and secret verify it at login.
 */
import { inArray } from 'drizzle-orm';
import { createDatabase, withSystemScope } from '@guaranix/db';
import { userCredentials, users } from '@guaranix/db/schema';
import { hashPassword } from '../src/lib/password';
import { localDatabaseUrl, localVars } from './local-dev';

export const DEMO_PASSWORD = 'guaranix-demo-2026';
const DEMO_EMAILS = [
  'admin@guaranix.local',
  'owner@box-demo-asuncion.local',
  'coach@box-demo-asuncion.local',
  'recepcion@box-demo-asuncion.local',
  'alumno@box-demo-asuncion.local',
];
// A known password must never reach a shared database.
const databaseUrl = localDatabaseUrl('Setting demo passwords');
const pepper = localVars.AUTH_SECRET;
if (!pepper) throw new Error('AUTH_SECRET is needed (copy apps/api/.dev.vars.example).');

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
