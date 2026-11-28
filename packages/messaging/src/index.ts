// Push, Telegram, WhatsApp and email behind common interfaces. Each provider is
// an adapter, so it can be swapped or replaced by a fake in tests.
export type { EmailMessage, EmailSender } from './email/email-sender';
export { createConsoleEmailSender } from './email/console-email-sender';
export { createMemoryEmailSender } from './email/memory-email-sender';
export { createResendEmailSender } from './email/resend-email-sender';
export type { ResendOptions } from './email/resend-email-sender';

export type {
  ChannelAddress,
  ChannelName,
  NotificationChannel,
  OutgoingMessage,
  PushAddress,
  SendResult,
  TelegramAddress,
  WhatsAppAddress,
  WhatsAppTemplate,
} from './notifications/channel';
export { ChannelError } from './notifications/channel-error';
export type { ChannelErrorKind } from './notifications/channel-error';
export { createConsoleChannel } from './notifications/console-channel';
export { createMemoryChannel } from './notifications/memory-channel';
export type { MemoryChannel, SentMessage } from './notifications/memory-channel';

export { createWebPushChannel } from './web-push/web-push-channel';
export type { PushPayload, WebPushOptions } from './web-push/web-push-channel';
export { generateVapidKeys } from './web-push/vapid';
export type { VapidKeys } from './web-push/vapid';

export { createTelegramChannel } from './telegram/telegram-channel';
export type { TelegramOptions } from './telegram/telegram-channel';
export { parseTelegramStart } from './telegram/telegram-update';
export type { TelegramStartCommand } from './telegram/telegram-update';

export { createWhatsAppCloudChannel } from './whatsapp/whatsapp-cloud-channel';
export type { WhatsAppCloudOptions } from './whatsapp/whatsapp-cloud-channel';
