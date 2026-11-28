/** Where a message goes. Each channel has its own address shape. */
export interface PushAddress {
  channel: 'push';
  /** Push service URL from the browser's `PushSubscription`. */
  endpoint: string;
  /** Subscription public key (`keys.p256dh`), base64url. */
  p256dh: string;
  /** Subscription auth secret (`keys.auth`), base64url. */
  auth: string;
}

export interface TelegramAddress {
  channel: 'telegram';
  chatId: string;
}

export interface WhatsAppAddress {
  channel: 'whatsapp';
  /** E.164, e.g. `+595981123456`. */
  phone: string;
}

export type ChannelAddress = PushAddress | TelegramAddress | WhatsAppAddress;
export type ChannelName = ChannelAddress['channel'];

/**
 * Business-initiated WhatsApp messages must use a template Meta approved
 * beforehand; free text is only allowed inside a 24 h customer service window.
 */
export interface WhatsAppTemplate {
  name: string;
  /** Meta language code of the approved template, e.g. `es`. */
  language: string;
  /** Values for `{{1}}`, `{{2}}`… of the template body, in order. */
  parameters: string[];
}

/** One message, already rendered in the user's language. */
export interface OutgoingMessage {
  title: string;
  body: string;
  /** Path or URL the notification opens. */
  url?: string;
  /** Push: a newer notification with the same tag replaces the older one. */
  tag?: string;
  /** Required by the WhatsApp channel. */
  whatsappTemplate?: WhatsAppTemplate;
}

export interface SendResult {
  /** Id the provider gave the message, when it returns one. */
  providerMessageId: string | null;
}

/** Any provider of one channel (a Web Push service, the Telegram Bot API, Meta…) implements this. */
export interface NotificationChannel<Address extends ChannelAddress = ChannelAddress> {
  readonly channel: Address['channel'];
  /** Throws `ChannelError` when the provider refuses or can't be reached. */
  send(address: Address, message: OutgoingMessage): Promise<SendResult>;
}
