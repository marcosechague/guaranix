import type { SchemaDatabase } from '@guaranix/db';
import { pushSubscriptions, telegramLinks } from '@guaranix/db/schema';
import {
  createMemoryChannel,
  type PushAddress,
  type TelegramAddress,
  type WhatsAppAddress,
} from '@guaranix/messaging';
import type { ServiceContext } from '../services/context';
import { handleNotificationJob, type QueueMessage } from '../services/notifications/consumer';
import { queueOutbox } from '../services/notifications/outbox';
import {
  createMemoryQueue,
  type NotificationJob,
  type NotificationServices,
} from '../services/notifications/queue';
import type { ServiceFixture } from './service-fixture';

let endpointCounter = 0;

export function createTestNotifications(): NotificationServices & {
  queue: ReturnType<typeof createMemoryQueue>;
  channels: {
    push: ReturnType<typeof createMemoryChannel<PushAddress>>;
    telegram: ReturnType<typeof createMemoryChannel<TelegramAddress>>;
    whatsapp: ReturnType<typeof createMemoryChannel<WhatsAppAddress>>;
  };
} {
  return {
    queue: createMemoryQueue(),
    channels: {
      push: createMemoryChannel<PushAddress>('push'),
      telegram: createMemoryChannel<TelegramAddress>('telegram'),
      whatsapp: createMemoryChannel<WhatsAppAddress>('whatsapp'),
    },
    config: {
      vapidPublicKey: 'BPublicKeyForTests',
      telegramBotUsername: 'GuaranixTestBot',
      telegramWebhookSecret: 'telegram-webhook-secret',
      whatsappTemplateLanguage: 'es',
      adminAppUrl: 'https://panel.example.com',
    },
  };
}

export type TestNotifications = ReturnType<typeof createTestNotifications>;

export function fakeQueueMessage(body: NotificationJob, attempts = 1) {
  const message = {
    body,
    attempts,
    acked: false,
    retryDelay: null as number | null,
    ack() {
      message.acked = true;
    },
    retry(options?: { delaySeconds?: number }) {
      message.retryDelay = options?.delaySeconds ?? 0;
    },
  } satisfies QueueMessage & Record<string, unknown>;
  return message;
}

/**
 * Runs queued jobs, and the jobs they queue, until none are left. Jobs that
 * asked for a retry are returned instead of being run again.
 */
export async function drainNotifications(
  database: SchemaDatabase,
  notifications: TestNotifications,
  now: Date,
) {
  const retried: { job: NotificationJob; delaySeconds: number }[] = [];
  for (let job = notifications.queue.jobs.shift(); job; job = notifications.queue.jobs.shift()) {
    const message = fakeQueueMessage(job);
    await handleNotificationJob(database, notifications, message, now);
    if (message.retryDelay !== null) retried.push({ job, delaySeconds: message.retryDelay });
  }
  return retried;
}

/** Runs `work` like a request would and queues what it recorded, as the router does after commit. */
export async function withOutbox<T>(
  notifications: TestNotifications,
  run: (work: (context: ServiceContext) => Promise<T>) => Promise<T>,
  work: (context: ServiceContext) => Promise<T>,
): Promise<T> {
  const outbox: string[] = [];
  const result = await run((context) => work({ ...context, outbox }));
  await queueOutbox(notifications.queue, outbox);
  return result;
}

export async function subscribePush(fixture: ServiceFixture, userId: string) {
  endpointCounter += 1;
  const endpoint = `https://push.example.com/${endpointCounter}`;
  await fixture.system((transaction) =>
    transaction
      .insert(pushSubscriptions)
      .values({ userId, endpoint, p256dh: 'p256dh-key', auth: 'auth-secret' }),
  );
  return endpoint;
}

export async function linkTelegram(fixture: ServiceFixture, userId: string, chatId: string) {
  await fixture.system((transaction) =>
    transaction.insert(telegramLinks).values({ userId, chatId }),
  );
}
