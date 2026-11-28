import {
  type SchemaDatabase,
  type ScopedTransaction,
  withBoxScope,
  withSystemScope,
} from '@guaranix/db';
import { boxes } from '@guaranix/db/schema';
import { inArray } from 'drizzle-orm';
import type { NotificationQueue } from '../services/notifications/queue';
import { queueOutbox } from '../services/notifications/outbox';

export interface BoxTarget {
  id: string;
  name: string;
  timezone: string;
}

export interface BoxJobResult {
  boxes: number;
  notifications: number;
  failedBoxIds: string[];
}

/**
 * Visits every working box in its own scoped transaction, collects the
 * notifications `work` records and queues them once that box commits. One
 * broken box never stops the rest.
 */
export async function forEachNotifyingBox(
  database: SchemaDatabase,
  queue: NotificationQueue,
  label: string,
  work: (transaction: ScopedTransaction, box: BoxTarget) => Promise<string[]>,
): Promise<BoxJobResult> {
  // Unscoped only to list which boxes to visit; the work itself runs under RLS.
  const targets = await withSystemScope(database, (transaction) =>
    transaction
      .select({ id: boxes.id, name: boxes.name, timezone: boxes.timezone })
      .from(boxes)
      .where(inArray(boxes.status, ['trial', 'active'])),
  );
  const result: BoxJobResult = { boxes: targets.length, notifications: 0, failedBoxIds: [] };
  for (const box of targets) {
    try {
      const ids = await withBoxScope(database, { boxId: box.id }, (transaction) =>
        work(transaction, box),
      );
      result.notifications += ids.length;
      await queueOutbox(queue, ids);
    } catch (error) {
      result.failedBoxIds.push(box.id);
      console.error(`${label} failed`, {
        boxId: box.id,
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
  }
  return result;
}
