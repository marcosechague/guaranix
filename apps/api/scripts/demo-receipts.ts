/**
 * Stores a placeholder receipt in the local R2 bucket for every seeded payment
 * that points at one, and a sample payment QR for every seeded box, so
 * "Ver comprobante" and the box's QR work in the local demo.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { like } from 'drizzle-orm';
import { createDatabase, withSystemScope } from '@guaranix/db';
import { boxes, payments } from '@guaranix/db/schema';
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
  const receiptKeys = rows.flatMap((row) => (row.key ? [row.key] : []));
  const qrRows = await withSystemScope(database, (transaction) =>
    transaction
      .select({ key: boxes.paymentQrFileKey })
      .from(boxes)
      .where(like(boxes.paymentQrFileKey, 'boxes/%/payment-qr/seed.png')),
  );
  const qrKeys = qrRows.flatMap((row) => (row.key ? [row.key] : []));
  const store = (key: string, file: string) =>
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
        resolve(import.meta.dirname, file),
        '--content-type',
        'image/png',
      ],
      { stdio: 'ignore' },
    );
  for (const key of receiptKeys) store(key, 'demo-receipt.png');
  for (const key of qrKeys) store(key, 'demo-payment-qr.png');
  console.log(
    `Demo receipt stored for ${receiptKeys.length} payments and QR for ${qrKeys.length} boxes.`,
  );
} finally {
  await database.$client.end();
}
