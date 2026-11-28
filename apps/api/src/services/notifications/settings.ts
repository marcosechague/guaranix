import type { ScopedTransaction } from '@guaranix/db';
import {
  notificationPreferences,
  pushSubscriptions,
  telegramLinkCodes,
  telegramLinks,
} from '@guaranix/db/schema';
import {
  NOTIFICATION_TOPICS,
  type NotificationPreference,
  type NotificationPreferenceInput,
  type NotificationSettings,
  type PushSubscriptionInput,
  TOPIC_CHANNELS,
  type TelegramLinkStart,
} from '@guaranix/shared';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { base64UrlEncode, randomBytes, sha256 } from '../../lib/crypto';
import { unprocessable } from '../errors';
import type { NotificationConfig } from './queue';

/** Long enough to open Telegram on another device, short enough not to linger. */
export const TELEGRAM_LINK_TTL_MS = 15 * 60_000;

// These run in the account router's unscoped transaction: every query is
// filtered by the signed-in user's id, so nobody reaches someone else's rows.

export async function getNotificationSettings(
  transaction: ScopedTransaction,
  userId: string,
  config: NotificationConfig,
): Promise<NotificationSettings> {
  const [saved, [subscriptions], [link]] = await Promise.all([
    transaction
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId)),
    transaction
      .select({ total: count() })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId)),
    transaction
      .select({ username: telegramLinks.username })
      .from(telegramLinks)
      .where(eq(telegramLinks.userId, userId)),
  ]);
  const off = new Set(
    saved.filter((row) => !row.enabled).map((row) => `${row.topic}:${row.channel}`),
  );
  const preferences: NotificationPreference[] = NOTIFICATION_TOPICS.flatMap((topic) =>
    TOPIC_CHANNELS[topic].map((channel) => ({
      topic,
      channel,
      enabled: !off.has(`${topic}:${channel}`),
    })),
  );
  return {
    preferences,
    push: {
      available: config.vapidPublicKey !== null,
      publicKey: config.vapidPublicKey,
      subscriptions: subscriptions?.total ?? 0,
    },
    telegram: {
      available: config.telegramBotUsername !== null,
      linked: link !== undefined,
      username: link?.username ?? null,
    },
  };
}

export async function setNotificationPreference(
  transaction: ScopedTransaction,
  userId: string,
  input: NotificationPreferenceInput,
): Promise<NotificationPreference> {
  await transaction
    .insert(notificationPreferences)
    .values({ userId, ...input })
    .onConflictDoUpdate({
      target: [
        notificationPreferences.userId,
        notificationPreferences.topic,
        notificationPreferences.channel,
      ],
      set: { enabled: input.enabled },
    });
  return { topic: input.topic, channel: input.channel, enabled: input.enabled };
}

/**
 * Saves this browser's subscription. An endpoint belongs to one browser, so
 * if someone else used to be logged in there, it now follows the new person.
 */
export async function savePushSubscription(
  transaction: ScopedTransaction,
  userId: string,
  input: PushSubscriptionInput,
): Promise<void> {
  const values = {
    userId,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    updatedAt: new Date(),
  };
  await transaction
    .insert(pushSubscriptions)
    .values({ ...values, endpoint: input.endpoint })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values });
  // A person has a few devices, not hundreds: keep the newest ones.
  const stale = await transaction
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .orderBy(desc(pushSubscriptions.updatedAt))
    .offset(MAX_PUSH_SUBSCRIPTIONS_PER_USER);
  if (stale.length > 0) {
    await transaction.delete(pushSubscriptions).where(
      inArray(
        pushSubscriptions.id,
        stale.map((row) => row.id),
      ),
    );
  }
}

export const MAX_PUSH_SUBSCRIPTIONS_PER_USER = 10;

export async function removePushSubscription(
  transaction: ScopedTransaction,
  userId: string,
  endpoint: string,
): Promise<void> {
  await transaction
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

/**
 * A single-use `t.me/<bot>?start=<code>` link. Only the code's hash is kept,
 * and asking again replaces the previous one.
 */
export async function startTelegramLink(
  transaction: ScopedTransaction,
  userId: string,
  config: NotificationConfig,
  now: Date,
): Promise<TelegramLinkStart> {
  if (!config.telegramBotUsername) throw unprocessable('telegram_unavailable');
  const code = base64UrlEncode(randomBytes(24));
  const expiresAt = new Date(now.getTime() + TELEGRAM_LINK_TTL_MS);
  await transaction.delete(telegramLinkCodes).where(eq(telegramLinkCodes.userId, userId));
  await transaction
    .insert(telegramLinkCodes)
    .values({ codeHash: await sha256(code), userId, expiresAt, createdAt: now });
  return {
    url: `https://t.me/${config.telegramBotUsername}?start=${code}`,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function unlinkTelegram(transaction: ScopedTransaction, userId: string) {
  await transaction.delete(telegramLinks).where(eq(telegramLinks.userId, userId));
  await transaction.delete(telegramLinkCodes).where(eq(telegramLinkCodes.userId, userId));
}
