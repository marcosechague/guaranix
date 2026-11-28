import type {
  NotificationAudience,
  NotificationParams,
  RenderedNotification,
} from '@guaranix/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './columns';
import {
  notificationChannelEnum,
  notificationDeliveryStatusEnum,
  notificationKindEnum,
  notificationTopicEnum,
} from './enums';
import { members } from './people';
import { users } from './platform';
import { denyAppRole } from './rls';
import { sameBoxReference, tenantColumns, tenantIsolationPolicy, tenantKey } from './tenant';

/**
 * Outbox of events (a class was cancelled, a WOD was published…), written in
 * the same transaction as the change. The queue consumer expands each one into
 * deliveries. The key makes the same event impossible to record twice.
 */
export const notifications = pgTable(
  'notifications',
  {
    ...tenantColumns(),
    kind: notificationKindEnum().notNull(),
    /** e.g. `class_cancelled:<class id>`; unique per box. */
    idempotencyKey: text().notNull(),
    audience: jsonb().$type<NotificationAudience>().notNull(),
    params: jsonb().$type<NotificationParams>().notNull(),
    actorUserId: uuid().references(() => users.id),
    /** Set once its deliveries exist; the sweeper re-queues rows still empty. */
    expandedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    tenantKey('notifications', table.boxId, table.id),
    unique('notifications_box_id_idempotency_key_unique').on(table.boxId, table.idempotencyKey),
    index('notifications_expanded_at_created_at_idx').on(table.expandedAt, table.createdAt),
    tenantIsolationPolicy(table.boxId),
  ],
);

/**
 * One message to one person on one channel. Unique per event, person and
 * channel, so retries and duplicated queue messages never send twice. WhatsApp
 * rows also count against the box's monthly quota.
 */
export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    ...tenantColumns(),
    notificationId: uuid().notNull(),
    channel: notificationChannelEnum().notNull(),
    /** `user:<id>` or `member:<id>` (a member without an account can still get WhatsApp). */
    recipientKey: text().notNull(),
    userId: uuid().references(() => users.id),
    memberId: uuid(),
    status: notificationDeliveryStatusEnum().notNull().default('queued'),
    /** Why it was skipped or failed: `quota_reached`, `telegram_403`… */
    statusReason: text(),
    attempts: integer().notNull().default(0),
    /** WhatsApp number, copied when the delivery is created. Push and Telegram resolve per user. */
    address: text(),
    message: jsonb().$type<RenderedNotification>().notNull(),
    providerMessageId: text(),
    sentAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    unique('notification_deliveries_once').on(
      table.notificationId,
      table.recipientKey,
      table.channel,
    ),
    sameBoxReference(
      'notification_deliveries_notification_fk',
      [table.boxId, table.notificationId],
      [notifications.boxId, notifications.id],
    ),
    sameBoxReference(
      'notification_deliveries_member_fk',
      [table.boxId, table.memberId],
      [members.boxId, members.id],
    ),
    index('notification_deliveries_box_id_channel_created_at_idx').on(
      table.boxId,
      table.channel,
      table.createdAt,
    ),
    index('notification_deliveries_status_updated_at_idx').on(table.status, table.updatedAt),
    check(
      'notification_deliveries_whatsapp_address',
      sql`${table.channel} <> 'whatsapp' or ${table.address} is not null`,
    ),
    tenantIsolationPolicy(table.boxId),
  ],
);

// Below: per person, not per box (one phone, one Telegram account across every
// box). Like login data they are reachable only through `withSystemScope`, and
// every service filters by the signed-in user's id.

/** A browser or installed app that accepted push notifications. */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: primaryId(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text().notNull().unique(),
    p256dh: text().notNull(),
    auth: text().notNull(),
    lastSuccessAt: timestamp({ withTimezone: true }),
    ...timestamps(),
  },
  (table) => [index('push_subscriptions_user_id_idx').on(table.userId), denyAppRole()],
);

/** The Telegram chat a person linked through the bot. */
export const telegramLinks = pgTable(
  'telegram_links',
  {
    userId: uuid()
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    chatId: text().notNull().unique(),
    username: text(),
    ...timestamps(),
  },
  () => [denyAppRole()],
);

/** Single-use code inside the `t.me/<bot>?start=` link. Only its SHA-256 is stored. */
export const telegramLinkCodes = pgTable(
  'telegram_link_codes',
  {
    codeHash: text().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('telegram_link_codes_user_id_idx').on(table.userId), denyAppRole()],
);

/** Only what a person turned off or back on; no row means "on". */
export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    topic: notificationTopicEnum().notNull(),
    channel: notificationChannelEnum().notNull(),
    enabled: boolean().notNull(),
    ...timestamps(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.topic, table.channel] }), denyAppRole()],
);
