import type { SchemaDatabase } from '@guaranix/db';
import { calendarDateIn, weekdayOf } from '@guaranix/shared';
import { writeWeeklySummary } from '../services/brodi/weekly-summary';
import { queueOutbox } from '../services/notifications/outbox';
import type { NotificationQueue } from '../services/notifications/queue';
import type { AiRuntime } from '../services/platform-ai';
import { type BoxJobResult, listWorkingBoxes } from './notifying-boxes';

const MONDAY = 1;

/**
 * Monday mornings: for each box where it is Monday locally, writes last
 * week's Brodi summary for each box that has Brodi. A re-run the same week
 * finds the summary already written and does nothing.
 */
export async function sendBrodiWeeklySummaries(
  database: SchemaDatabase,
  queue: NotificationQueue,
  ai: AiRuntime,
  now: Date,
): Promise<BoxJobResult> {
  const targets = await listWorkingBoxes(database);
  const result: BoxJobResult = { boxes: 0, notifications: 0, failedBoxIds: [] };
  for (const box of targets) {
    if (weekdayOf(calendarDateIn(box.timezone, now)) !== MONDAY) continue;
    result.boxes += 1;
    try {
      const notificationId = await writeWeeklySummary({ database, ai, now }, box);
      if (notificationId) {
        result.notifications += 1;
        await queueOutbox(queue, [notificationId]);
      }
    } catch (error) {
      result.failedBoxIds.push(box.id);
      console.error('Brodi weekly summary failed', {
        boxId: box.id,
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
  }
  return result;
}
