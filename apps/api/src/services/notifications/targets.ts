import { type SchemaDatabase, withSystemScope } from '@guaranix/db';
import type { notificationDeliveries } from '@guaranix/db/schema';
import { pushSubscriptions, telegramLinks } from '@guaranix/db/schema';
import type { ChannelAddress } from '@guaranix/messaging';
import { and, eq } from 'drizzle-orm';

type DeliveryRow = typeof notificationDeliveries.$inferSelect;

export interface Target {
  address: ChannelAddress;
  /** Forget this address when the provider says it is gone. */
  forget(): Promise<void>;
  /** Remember the address worked (push only). */
  succeeded(): Promise<void>;
}

/** Every address the delivery's person has on its channel: all their devices, for push. */
export async function targetsOf(
  database: SchemaDatabase,
  delivery: DeliveryRow,
  now: Date,
): Promise<Target[]> {
  const noop = async () => {};
  if (delivery.channel === 'whatsapp') {
    return delivery.address
      ? [
          {
            address: { channel: 'whatsapp', phone: delivery.address },
            forget: noop,
            succeeded: noop,
          },
        ]
      : [];
  }
  const userId = delivery.userId;
  if (!userId) return [];
  return withSystemScope(database, async (transaction) => {
    if (delivery.channel === 'telegram') {
      const [link] = await transaction
        .select()
        .from(telegramLinks)
        .where(eq(telegramLinks.userId, userId));
      if (!link) return [];
      const forget = () =>
        withSystemScope(database, (tx) =>
          tx
            .delete(telegramLinks)
            .where(and(eq(telegramLinks.userId, userId), eq(telegramLinks.chatId, link.chatId))),
        ).then(noop);
      return [{ address: { channel: 'telegram', chatId: link.chatId }, forget, succeeded: noop }];
    }
    const subscriptions = await transaction
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    return subscriptions.map((subscription) => ({
      address: {
        channel: 'push' as const,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
      forget: () =>
        withSystemScope(database, (tx) =>
          tx.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscription.id)),
        ).then(noop),
      succeeded: () =>
        withSystemScope(database, (tx) =>
          tx
            .update(pushSubscriptions)
            .set({ lastSuccessAt: now })
            .where(eq(pushSubscriptions.id, subscription.id)),
        ).then(noop),
    }));
  });
}
