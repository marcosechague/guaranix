import { z } from 'zod';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TOPICS,
  type BoxRole,
  type NotificationChannel,
  type NotificationKind,
  type NotificationTopic,
} from '../domain/enums';

export const notificationChannelSchema = z.enum(NOTIFICATION_CHANNELS);
export const notificationTopicSchema = z.enum(NOTIFICATION_TOPICS);

/** Topic of each event and the channels it may use. Everything else derives from this table. */
export const NOTIFICATION_ROUTING = {
  booking_confirmed: { topic: 'bookings', channels: ['push'] },
  waitlist_promoted: { topic: 'bookings', channels: ['push'] },
  class_cancelled: { topic: 'bookings', channels: ['push'] },
  workout_published: { topic: 'workouts', channels: ['push'] },
  membership_due: { topic: 'billing', channels: ['push', 'whatsapp'] },
  membership_overdue: { topic: 'billing', channels: ['push', 'whatsapp'] },
  staff_class_cancelled: { topic: 'staff', channels: ['telegram'] },
  staff_overdue_digest: { topic: 'staff', channels: ['telegram'] },
} as const satisfies Record<
  NotificationKind,
  { topic: NotificationTopic; channels: readonly NotificationChannel[] }
>;

/** The channels each topic can reach, for the settings screens. */
export const TOPIC_CHANNELS: Record<NotificationTopic, readonly NotificationChannel[]> = {
  bookings: ['push'],
  workouts: ['push'],
  billing: ['push', 'whatsapp'],
  staff: ['telegram'],
};

export const notificationPreferenceInputSchema = z
  .object({
    topic: notificationTopicSchema,
    channel: notificationChannelSchema,
    enabled: z.boolean(),
  })
  .refine((value) => TOPIC_CHANNELS[value.topic].includes(value.channel), {
    message: 'This topic does not use that channel',
  });

/** What the browser's `PushSubscription.toJSON()` returns. */
export const pushSubscriptionInputSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  keys: z.object({
    p256dh: z
      .string()
      .min(80)
      .max(120)
      .regex(/^[A-Za-z0-9_-]+=*$/),
    auth: z
      .string()
      .min(16)
      .max(40)
      .regex(/^[A-Za-z0-9_-]+=*$/),
  }),
});

export const pushUnsubscribeInputSchema = pushSubscriptionInputSchema.pick({ endpoint: true });

/**
 * A Telegram webhook update. Only `message` matters and every field is
 * optional, so updates of kinds we ignore still validate (and get a 200).
 */
export const telegramUpdateSchema = z.looseObject({
  update_id: z.number().optional(),
  message: z
    .looseObject({
      text: z.string().max(4096).optional(),
      chat: z.looseObject({ id: z.union([z.number(), z.string()]), type: z.string() }).optional(),
      from: z.looseObject({ username: z.string().max(64).optional() }).optional(),
    })
    .optional(),
});

export type NotificationPreferenceInput = z.input<typeof notificationPreferenceInputSchema>;
export type PushSubscriptionInput = z.input<typeof pushSubscriptionInputSchema>;

export interface NotificationPreference {
  topic: NotificationTopic;
  channel: NotificationChannel;
  enabled: boolean;
}

/** `GET /notifications/settings`: what a person can turn on, and what is already set up. */
export interface NotificationSettings {
  /** Every topic and channel pair, on unless the person turned it off. */
  preferences: NotificationPreference[];
  push: {
    /** False when the API has no VAPID key: the apps hide the push switch. */
    available: boolean;
    /** VAPID public key the browser subscribes with. */
    publicKey: string | null;
    subscriptions: number;
  };
  telegram: {
    available: boolean;
    linked: boolean;
    username: string | null;
  };
}

export interface TelegramLinkStart {
  /** `https://t.me/<bot>?start=<code>`: opening it and tapping Start links the chat. */
  url: string;
  expiresAt: string;
}

/** Who an event is for; the queue consumer turns it into one delivery per person and channel. */
export type NotificationAudience =
  | { type: 'members'; memberIds: string[] }
  | { type: 'users'; userIds: string[] }
  /** Every active member with an account: WOD published. */
  | { type: 'active_members' }
  /** Staff with one of these roles: internal notices. */
  | { type: 'staff'; roles: BoxRole[] };

/** Event data the texts are rendered from. Only names, dates and amounts: never secrets. */
export type NotificationParams = Record<string, string | number | null>;

/** A message as rendered for one delivery, kept so a retry sends exactly the same thing. */
export interface RenderedNotification {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  whatsappTemplate?: { name: string; language: string; parameters: string[] };
}
