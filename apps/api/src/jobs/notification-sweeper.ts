import { type SchemaDatabase, withSystemScope } from '@guaranix/db';
import { notifications } from '@guaranix/db/schema';
import { and, gt, isNull, lt } from 'drizzle-orm';
import { findStalledDeliveries } from '../services/notifications/deliver';
import type { NotificationJob, NotificationQueue } from '../services/notifications/queue';

const MINUTE_MS = 60_000;
/** Give the request's own enqueue time to land before assuming it was lost. */
const UNQUEUED_AFTER_MS = 2 * MINUTE_MS;
/** Events older than this are stale news; they are left unsent rather than delivered late. */
const STALE_AFTER_MS = 24 * 60 * MINUTE_MS;
const BATCH = 500;

/**
 * Every few minutes: queues again what fell through the cracks (the queue was
 * down when a request committed, a worker died mid-job, a retry ran out).
 * Every job is idempotent, so queueing something twice is harmless.
 */
export async function sweepNotifications(
  database: SchemaDatabase,
  queue: NotificationQueue,
  now: Date,
): Promise<{ expand: number; send: number }> {
  const pending = await withSystemScope(database, (transaction) =>
    transaction
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          isNull(notifications.expandedAt),
          lt(notifications.createdAt, new Date(now.getTime() - UNQUEUED_AFTER_MS)),
          gt(notifications.createdAt, new Date(now.getTime() - STALE_AFTER_MS)),
        ),
      )
      .limit(BATCH),
  );
  const stalled = await findStalledDeliveries(database, now, BATCH);
  const jobs: NotificationJob[] = [
    ...pending.map((row) => ({ type: 'expand' as const, notificationId: row.id })),
    ...stalled.map((deliveryId) => ({ type: 'send' as const, deliveryId })),
  ];
  await queue.send(jobs);
  return { expand: pending.length, send: stalled.length };
}
