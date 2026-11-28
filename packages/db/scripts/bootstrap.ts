import { createDatabase } from '../src/client.ts';
import { readDatabaseUrl } from '../src/database-url.ts';
import { bootstrapPlatform } from '../src/seed/bootstrap.ts';

// Runs after the migrations on every deploy (docs/despliegue.md). Never seeds demo data.
const database = createDatabase(readDatabaseUrl(process.env));

try {
  const result = await bootstrapPlatform(database, {
    platformAdminEmail: process.env['PLATFORM_ADMIN_EMAIL'],
  });
  console.log(
    `Platform plans inserted: ${result.plansInserted}. Platform admin: ${result.platformAdmin}.`,
  );
} finally {
  await database.$client.end();
}
