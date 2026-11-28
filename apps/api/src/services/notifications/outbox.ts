import type { NotificationQueue } from './queue';

/**
 * Queues events after their transaction committed. A failure here loses
 * nothing: the rows are in Postgres and the sweeper queues them again.
 */
export async function queueOutbox(queue: NotificationQueue, notificationIds: string[]) {
  if (notificationIds.length === 0) return;
  try {
    await queue.send(notificationIds.map((notificationId) => ({ type: 'expand', notificationId })));
  } catch (error) {
    console.error('Queueing notifications failed', {
      count: notificationIds.length,
      error: error instanceof Error ? error.name : 'unknown',
    });
  }
}
