import type { SchemaDatabase } from '@guaranix/db';
import { backoffSeconds, sendDelivery } from './deliver';
import { expandNotification } from './expand';
import type { NotificationJob, NotificationServices } from './queue';

/** The part of a Cloudflare Queue `Message` the consumer uses, so tests can fake it. */
export interface QueueMessage {
  readonly body: NotificationJob;
  readonly attempts: number;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
}

/**
 * Runs one queue job. Expanding queues one `send` job per delivery; sending
 * asks to be retried with backoff when the provider is temporarily down.
 */
export async function handleNotificationJob(
  database: SchemaDatabase,
  notifications: NotificationServices,
  message: QueueMessage,
  now: Date,
): Promise<void> {
  try {
    if (message.body.type === 'expand') {
      const deliveryIds = await expandNotification(
        database,
        notifications.config,
        message.body.notificationId,
        now,
      );
      await notifications.queue.send(
        deliveryIds.map((deliveryId) => ({ type: 'send', deliveryId })),
      );
      message.ack();
      return;
    }
    const outcome = await sendDelivery(
      database,
      notifications.channels,
      message.body.deliveryId,
      now,
    );
    if (outcome.result === 'retry') message.retry({ delaySeconds: outcome.delaySeconds });
    else message.ack();
  } catch (error) {
    // Database or queue trouble: everything above is idempotent, so try the job again.
    console.error('Notification job failed', {
      type: message.body.type,
      error: error instanceof Error ? error.name : 'unknown',
    });
    message.retry({ delaySeconds: backoffSeconds(message.attempts) });
  }
}

export async function handleNotificationBatch(
  database: SchemaDatabase,
  notifications: NotificationServices,
  messages: readonly QueueMessage[],
  now: Date,
): Promise<void> {
  for (const message of messages) {
    await handleNotificationJob(database, notifications, message, now);
  }
}
