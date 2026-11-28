import {
  createConsoleChannel,
  createTelegramChannel,
  createWebPushChannel,
  createWhatsAppCloudChannel,
  type TelegramAddress,
  type WhatsAppAddress,
} from '@guaranix/messaging';
import type { Bindings } from '../../env';
import {
  createCloudflareQueue,
  createMissingQueue,
  type NotificationChannels,
  type NotificationConfig,
  type NotificationServices,
} from './queue';

const DEFAULT_VAPID_SUBJECT = 'mailto:soporte@guaranix.com.py';

/**
 * In development a channel without keys prints to the terminal, so every
 * event can be tried locally. Elsewhere it stays off until its secrets exist:
 * notifications are optional, unlike login protection.
 */
function channelsFor(env: Bindings): NotificationChannels {
  const development = env.APP_ENV === 'development';
  const push =
    env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
      ? createWebPushChannel({
          vapid: {
            publicKey: env.VAPID_PUBLIC_KEY,
            privateKey: env.VAPID_PRIVATE_KEY,
            subject: env.VAPID_SUBJECT ?? DEFAULT_VAPID_SUBJECT,
          },
        })
      : null;
  const telegram = env.TELEGRAM_BOT_TOKEN
    ? createTelegramChannel({ botToken: env.TELEGRAM_BOT_TOKEN })
    : development
      ? createConsoleChannel<TelegramAddress>('telegram', env.APP_ENV)
      : null;
  const whatsapp =
    env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID
      ? createWhatsAppCloudChannel({
          accessToken: env.WHATSAPP_ACCESS_TOKEN,
          phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
        })
      : development
        ? createConsoleChannel<WhatsAppAddress>('whatsapp', env.APP_ENV)
        : null;
  return { push, telegram, whatsapp };
}

export function notificationConfigFor(env: Bindings): NotificationConfig {
  return {
    vapidPublicKey: env.VAPID_PRIVATE_KEY ? (env.VAPID_PUBLIC_KEY ?? null) : null,
    telegramBotUsername: env.TELEGRAM_BOT_TOKEN ? (env.TELEGRAM_BOT_USERNAME ?? null) : null,
    telegramWebhookSecret: env.TELEGRAM_WEBHOOK_SECRET ?? null,
    whatsappTemplateLanguage: env.WHATSAPP_TEMPLATE_LANGUAGE ?? 'es',
    adminAppUrl: env.ADMIN_APP_URL ?? null,
  };
}

export function createNotificationServices(env: Bindings): NotificationServices {
  return {
    queue: env.NOTIFICATIONS_QUEUE
      ? createCloudflareQueue(env.NOTIFICATIONS_QUEUE)
      : createMissingQueue(),
    channels: channelsFor(env),
    config: notificationConfigFor(env),
  };
}
