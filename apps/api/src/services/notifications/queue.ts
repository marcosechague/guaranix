import type {
  NotificationChannel,
  PushAddress,
  TelegramAddress,
  WhatsAppAddress,
} from '@guaranix/messaging';

/** Messages on the `guaranix-notifications` Cloudflare Queue. Ids only: the data stays in Postgres. */
export type NotificationJob =
  { type: 'expand'; notificationId: string } | { type: 'send'; deliveryId: string };

export interface NotificationQueue {
  send(jobs: NotificationJob[]): Promise<void>;
}

/** Cloudflare accepts at most 100 messages per `sendBatch`. */
const BATCH_LIMIT = 100;

export function createCloudflareQueue(queue: Queue<NotificationJob>): NotificationQueue {
  return {
    async send(jobs) {
      for (let start = 0; start < jobs.length; start += BATCH_LIMIT) {
        await queue.sendBatch(jobs.slice(start, start + BATCH_LIMIT).map((body) => ({ body })));
      }
    },
  };
}

/** Keeps jobs in memory, for tests: they run them with `drainNotificationQueue`. */
export function createMemoryQueue(): NotificationQueue & { jobs: NotificationJob[] } {
  const jobs: NotificationJob[] = [];
  return {
    jobs,
    async send(newJobs) {
      jobs.push(...newJobs);
    },
  };
}

/** Without the binding nothing is sent; the sweeper queues the backlog once it exists. */
export function createMissingQueue(): NotificationQueue {
  return {
    async send(jobs) {
      if (jobs.length > 0) console.warn('NOTIFICATIONS_QUEUE is not bound', { jobs: jobs.length });
    },
  };
}

/** A channel is null when its provider isn't configured; its deliveries are skipped. */
export interface NotificationChannels {
  push: NotificationChannel<PushAddress> | null;
  telegram: NotificationChannel<TelegramAddress> | null;
  whatsapp: NotificationChannel<WhatsAppAddress> | null;
}

export interface NotificationConfig {
  /** Public half of the VAPID pair; null turns push off in the apps. */
  vapidPublicKey: string | null;
  /** Bot username without `@`, for the `t.me` link. */
  telegramBotUsername: string | null;
  /** Telegram sends it back in `X-Telegram-Bot-Api-Secret-Token` on every webhook call. */
  telegramWebhookSecret: string | null;
  /** Language code the WhatsApp templates were approved in. */
  whatsappTemplateLanguage: string;
  /** Admin panel origin, for links in Telegram messages. */
  adminAppUrl: string | null;
}

export interface NotificationServices {
  queue: NotificationQueue;
  channels: NotificationChannels;
  config: NotificationConfig;
}
