/**
 * Stores a placeholder receipt in the local R2 bucket for every seeded payment
 * that points at one, so "Ver comprobante" works in the local demo.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { like } from 'drizzle-orm';
import { createDatabase, withSystemScope } from '@guaranix/db';
import { payments } from '@guaranix/db/schema';
import { localDatabaseUrl } from './local-dev';

const BUCKET = 'guaranix-receipts';
const database = createDatabase(localDatabaseUrl('Storing demo receipts'));
try {
  const rows = await withSystemScope(database, (transaction) =>
    transaction
      .select({ key: payments.receiptFileKey })
      .from(payments)
      .where(like(payments.receiptFileKey, 'boxes/%/receipts/seed/%')),
  );
  const keys = rows.flatMap((row) => (row.key ? [row.key] : []));
  for (const key of keys) {
    // `--local` writes where `wrangler dev` reads its simulated R2 bucket.
    execFileSync(
      'pnpm',
      [
        'exec',
        'wrangler',
        'r2',
        'object',
        'put',
        `${BUCKET}/${key}`,
        '--local',
        '--file',
        resolve(import.meta.dirname, 'demo-receipt.png'),
        '--content-type',
        'image/png',
      ],
      { stdio: 'ignore' },
    );
  }
  console.log(`Demo receipt stored for ${keys.length} payments.`);
} finally {
  await database.$client.end();
}
