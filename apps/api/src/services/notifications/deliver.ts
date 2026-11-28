import { type SchemaDatabase, withSystemScope } from '@guaranix/db';
import { notificationDeliveries } from '@guaranix/db/schema';
import { ChannelError, type ChannelAddress, type OutgoingMessage } from '@guaranix/messaging';
import { and, eq, lt, ne, or, sql } from 'drizzle-orm';
import type { NotificationChannels } from './queue';
import { type Target, targetsOf } from './targets';

type DeliveryRow = typeof notificationDeliveries.$inferSelect;

/** Attempts before a delivery is given up as failed. */
export const MAX_DELIVERY_ATTEMPTS = 5;
/** A delivery stuck in `sending` this long means the worker died mid-send. */
export const STALE_SENDING_MS = 10 * 60_000;
const MAX_BACKOFF_SECONDS = 15 * 60;

export type DeliveryOutcome = { result: 'done' } | { result: 'retry'; delaySeconds: number };

/** 30 s, 2 min, 8 min, then capped at 15 min; a provider's own hint wins if longer. */
export function backoffSeconds(attempt: number, hint: number | null = null): number {
  const exponential = Math.min(MAX_BACKOFF_SECONDS, 30 * 4 ** Math.max(0, attempt - 1));
  return Math.max(exponential, Math.min(hint ?? 0, MAX_BACKOFF_SECONDS));
}

/**
 * Takes the delivery for this worker. A row left in `sending` by a crashed
 * worker is taken again, except WhatsApp: it may already have been delivered
 * and paid for, so it is closed as failed instead of risking a duplicate.
 */
async function claim(database: SchemaDatabase, deliveryId: string, now: Date) {
  return withSystemScope(database, async (transaction) => {
    const staleBefore = new Date(now.getTime() - STALE_SENDING_MS);
    const claimable = or(
      eq(notificationDeliveries.status, 'queued'),
      and(
        eq(notificationDeliveries.status, 'sending'),
        lt(notificationDeliveries.updatedAt, staleBefore),
        ne(notificationDeliveries.channel, 'whatsapp'),
      ),
    );
    const [claimed] = await transaction
      .update(notificationDeliveries)
      .set({ status: 'sending', attempts: sqlIncrement(), updatedAt: now })
      .where(and(eq(notificationDeliveries.id, deliveryId), claimable))
      .returning();
    if (claimed) return claimed;
    await transaction
      .update(notificationDeliveries)
      .set({ status: 'failed', statusReason: 'interrupted', updatedAt: now })
      .where(
        and(
          eq(notificationDeliveries.id, deliveryId),
          eq(notificationDeliveries.status, 'sending'),
          eq(notificationDeliveries.channel, 'whatsapp'),
          lt(notificationDeliveries.updatedAt, staleBefore),
        ),
      );
    return null;
  });
}

function sqlIncrement() {
  return sql`${notificationDeliveries.attempts} + 1`;
}

function available<T>(channel: T | null): T {
  if (!channel) throw new ChannelError('permanent', 'channel_unavailable');
  return channel;
}

function sendThrough(
  channels: NotificationChannels,
  address: ChannelAddress,
  message: OutgoingMessage,
) {
  switch (address.channel) {
    case 'push':
      return available(channels.push).send(address, message);
    case 'telegram':
      return available(channels.telegram).send(address, message);
    case 'whatsapp':
      return available(channels.whatsapp).send(address, message);
  }
}

interface Attempt {
  sent: number;
  providerMessageId: string | null;
  /** Highest-priority error seen: retryable beats the others, so one flaky device gets a retry. */
  error: ChannelError | null;
}

async function sendToTargets(
  channels: NotificationChannels,
  delivery: DeliveryRow,
  targets: Target[],
): Promise<Attempt> {
  const attempt: Attempt = { sent: 0, providerMessageId: null, error: null };
  const message = delivery.message as OutgoingMessage;
  for (const target of targets) {
    try {
      const result = await sendThrough(channels, target.address, message);
      attempt.sent += 1;
      attempt.providerMessageId ??= result.providerMessageId;
      await target.succeeded();
    } catch (error) {
      const channelError =
        error instanceof ChannelError ? error : new ChannelError('retryable', 'unexpected');
      if (channelError.kind === 'address_gone') await target.forget();
      if (!attempt.error || channelError.kind === 'retryable') attempt.error = channelError;
    }
  }
  return attempt;
}

async function finish(
  database: SchemaDatabase,
  deliveryId: string,
  values: Partial<typeof notificationDeliveries.$inferInsert>,
  now: Date,
) {
  await withSystemScope(database, (transaction) =>
    transaction
      .update(notificationDeliveries)
      .set({ ...values, updatedAt: now })
      .where(eq(notificationDeliveries.id, deliveryId)),
  );
}

/**
 * Sends one delivery to every address its person has on that channel (all
 * their devices, for push). Never sends a delivery already sent, so a
 * duplicated queue message is harmless.
 */
export async function sendDelivery(
  database: SchemaDatabase,
  channels: NotificationChannels,
  deliveryId: string,
  now: Date,
): Promise<DeliveryOutcome> {
  const delivery = await claim(database, deliveryId, now);
  if (!delivery) return { result: 'done' };
  if (!channels[delivery.channel]) {
    await finish(
      database,
      delivery.id,
      { status: 'skipped', statusReason: 'channel_unavailable' },
      now,
    );
    return { result: 'done' };
  }
  const targets = await targetsOf(database, delivery, now);
  if (targets.length === 0) {
    await finish(database, delivery.id, { status: 'skipped', statusReason: 'no_address' }, now);
    return { result: 'done' };
  }
  const attempt = await sendToTargets(channels, delivery, targets);
  if (attempt.sent > 0) {
    await finish(
      database,
      delivery.id,
      {
        status: 'sent',
        statusReason: null,
        sentAt: now,
        providerMessageId: attempt.providerMessageId,
      },
      now,
    );
    return { result: 'done' };
  }
  const error = attempt.error ?? new ChannelError('permanent', 'unknown');
  if (error.kind === 'retryable' && delivery.attempts < MAX_DELIVERY_ATTEMPTS) {
    await finish(database, delivery.id, { status: 'queued', statusReason: error.code }, now);
    return {
      result: 'retry',
      delaySeconds: backoffSeconds(delivery.attempts, error.retryAfterSeconds),
    };
  }
  await finish(database, delivery.id, { status: 'failed', statusReason: error.code }, now);
  return { result: 'done' };
}

/** Deliveries left `queued` or stuck in `sending`, for the sweeper to queue again. */
export async function findStalledDeliveries(database: SchemaDatabase, now: Date, limit: number) {
  const before = new Date(now.getTime() - 2 * MAX_BACKOFF_SECONDS * 1000);
  const staleSending = new Date(now.getTime() - STALE_SENDING_MS);
  const rows = await withSystemScope(database, (transaction) =>
    transaction
      .select({ id: notificationDeliveries.id })
      .from(notificationDeliveries)
      .where(
        or(
          and(
            eq(notificationDeliveries.status, 'queued'),
            lt(notificationDeliveries.updatedAt, before),
          ),
          and(
            eq(notificationDeliveries.status, 'sending'),
            lt(notificationDeliveries.updatedAt, staleSending),
          ),
        ),
      )
      .limit(limit),
  );
  return rows.map((row) => row.id);
}
