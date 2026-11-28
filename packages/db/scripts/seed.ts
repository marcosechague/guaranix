import { eq } from 'drizzle-orm';
import { createDatabase } from '../src/client.ts';
import { readLocalDatabaseUrl } from '../src/database-url.ts';
import { seedDemoBox, seedPlatform, seedShowcase } from '../src/seed/index.ts';
import { boxes } from '../src/schema/index.ts';
import { withSystemScope } from '../src/scope.ts';

const database = createDatabase(readLocalDatabaseUrl(process.env, 'The demo seed'));

try {
  const existing = await withSystemScope(database, (transaction) =>
    transaction.select({ id: boxes.id }).from(boxes).where(eq(boxes.slug, 'box-demo-asuncion')),
  );
  if (existing.length > 0) {
    console.log('Demo box already seeded; run `pnpm db:reset && pnpm db:migrate` to start over.');
  } else {
    const platform = await seedPlatform(database);
    const demo = await seedDemoBox(database, { platformPlanId: platform.foundersPlanId });
    await seedShowcase(database, { ...demo, slug: 'box-demo-asuncion' });
    console.log(`Seeded demo box ${demo.boxId} with ${demo.memberCount} members.`);
  }
} finally {
  await database.$client.end();
}
