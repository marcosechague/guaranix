import { type SchemaDatabase, type ScopedTransaction, withSystemScope } from '@guaranix/db';
import {
  boxes,
  notificationDeliveries,
  notificationPreferences,
  notifications,
  pushSubscriptions,
  telegramLinks,
} from '@guaranix/db/schema';
import {
  NOTIFICATION_ROUTING,
  type NotificationChannel,
  type NotificationDeliveryStatus,
  type RenderedNotification,
} from '@guaranix/shared';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { boxFeatureState } from '../feature-access';
import type { NotificationConfig } from './queue';
import { type Recipient, resolveRecipients } from './recipients';
import { renderNotification } from './render';

/** Suspended or removed boxes stop notifying; their events are closed unsent. */
const NOTIFYING_STATUSES = new Set(['trial', 'active']);

type NotificationRow = typeof notifications.$inferSelect;
type DeliveryInsert = typeof notificationDeliveries.$inferInsert;

interface Reachability {
  optedOut: Set<string>;
  push: Set<string>;
  telegram: Set<string>;
}

async function reachability(
  transaction: ScopedTransaction,
  topic: (typeof NOTIFICATION_ROUTING)[keyof typeof NOTIFICATION_ROUTING]['topic'],
  userIds: string[],
): Promise<Reachability> {
  if (userIds.length === 0) return { optedOut: new Set(), push: new Set(), telegram: new Set() };
  const [preferences, subscribed, linked] = await Promise.all([
    transaction
      .select({ userId: notificationPreferences.userId, channel: notificationPreferences.channel })
      .from(notificationPreferences)
      .where(
        and(
          inArray(notificationPreferences.userId, userIds),
          eq(notificationPreferences.topic, topic),
          eq(notificationPreferences.enabled, false),
        ),
      ),
    transaction
      .selectDistinct({ userId: pushSubscriptions.userId })
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, userIds)),
    transaction
      .select({ userId: telegramLinks.userId })
      .from(telegramLinks)
      .where(inArray(telegramLinks.userId, userIds)),
  ]);
  return {
    optedOut: new Set(preferences.map((row) => `${row.userId}:${row.channel}`)),
    push: new Set(subscribed.map((row) => row.userId)),
    telegram: new Set(linked.map((row) => row.userId)),
  };
}

/** Whether the box's plan includes WhatsApp, and how many messages are left this month. */
async function whatsappAllowance(
  transaction: ScopedTransaction,
  boxId: string,
  now: Date,
): Promise<{ enabled: boolean; left: number }> {
  // Two expansions for the same box must not both spend the last message.
  await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`whatsapp:${boxId}`}))`);
  const state = await boxFeatureState(transaction, boxId, 'whatsapp', now);
  if (!state.effective.enabled) return { enabled: false, left: 0 };
  const limit = state.effective.monthlyLimit;
  const left = limit === null ? Number.POSITIVE_INFINITY : Math.max(0, limit - state.usedThisMonth);
  return { enabled: true, left };
}

function recipientKey(recipient: Recipient): string {
  return recipient.userId ? `user:${recipient.userId}` : `member:${recipient.memberId ?? ''}`;
}

/** Whether `channel` can reach this person at all: an address, and not opted out. */
function reaches(recipient: Recipient, channel: NotificationChannel, reach: Reachability): boolean {
  if (recipient.userId && reach.optedOut.has(`${recipient.userId}:${channel}`)) return false;
  if (channel === 'push') return recipient.userId !== null && reach.push.has(recipient.userId);
  if (channel === 'telegram')
    return recipient.userId !== null && reach.telegram.has(recipient.userId);
  return recipient.phone !== null;
}

async function buildDeliveries(
  transaction: ScopedTransaction,
  notification: NotificationRow,
  box: { name: string },
  config: NotificationConfig,
  now: Date,
): Promise<DeliveryInsert[]> {
  const routing = NOTIFICATION_ROUTING[notification.kind];
  const recipients = await resolveRecipients(
    transaction,
    notification.boxId,
    notification.audience,
  );
  const userIds = recipients.flatMap((recipient) => (recipient.userId ? [recipient.userId] : []));
  const reach = await reachability(transaction, routing.topic, userIds);
  const channels: readonly NotificationChannel[] = routing.channels;
  const whatsapp = channels.includes('whatsapp')
    ? await whatsappAllowance(transaction, notification.boxId, now)
    : { enabled: false, left: 0 };
  let whatsappLeft = whatsapp.left;

  const rows: DeliveryInsert[] = [];
  for (const recipient of recipients) {
    for (const channel of channels) {
      if (!reaches(recipient, channel, reach)) continue;
      let status: NotificationDeliveryStatus = 'queued';
      let statusReason: string | null = null;
      if (channel === 'whatsapp') {
        // A box without the feature never sends WhatsApp, so there is nothing to record.
        if (!whatsapp.enabled) continue;
        if (whatsappLeft <= 0) {
          status = 'skipped';
          statusReason = 'quota_reached';
        } else {
          whatsappLeft -= 1;
        }
      }
      const message: RenderedNotification = renderNotification(
        notification.kind,
        notification.params,
        channel,
        {
          boxName: box.name,
          firstName: recipient.firstName,
          whatsappLanguage: config.whatsappTemplateLanguage,
          adminAppUrl: config.adminAppUrl,
        },
      );
      rows.push({
        boxId: notification.boxId,
        notificationId: notification.id,
        channel,
        recipientKey: recipientKey(recipient),
        userId: recipient.userId,
        memberId: recipient.memberId,
        status,
        statusReason,
        address: channel === 'whatsapp' ? recipient.phone : null,
        message,
        // The monthly WhatsApp count goes by this date.
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return rows;
}

/**
 * Turns one recorded event into one delivery per person and channel and
 * returns the ids to send. Safe to run twice: an expanded event only returns
 * its deliveries still waiting, and the unique key stops duplicates.
 */
export async function expandNotification(
  database: SchemaDatabase,
  config: NotificationConfig,
  notificationId: string,
  now: Date,
): Promise<string[]> {
  return withSystemScope(database, async (transaction) => {
    const [notification] = await transaction
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .for('update');
    if (!notification) return [];
    if (!notification.expandedAt) {
      const [box] = await transaction
        .select({ name: boxes.name, status: boxes.status })
        .from(boxes)
        .where(eq(boxes.id, notification.boxId));
      if (box && NOTIFYING_STATUSES.has(box.status)) {
        const rows = await buildDeliveries(transaction, notification, box, config, now);
        if (rows.length > 0) {
          await transaction.insert(notificationDeliveries).values(rows).onConflictDoNothing();
        }
      }
      await transaction
        .update(notifications)
        .set({ expandedAt: now })
        .where(eq(notifications.id, notification.id));
    }
    const queued = await transaction
      .select({ id: notificationDeliveries.id })
      .from(notificationDeliveries)
      .where(
        and(
          eq(notificationDeliveries.notificationId, notification.id),
          eq(notificationDeliveries.status, 'queued'),
        ),
      );
    return queued.map((row) => row.id);
  });
}
