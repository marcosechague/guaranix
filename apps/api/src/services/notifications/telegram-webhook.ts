import { type SchemaDatabase, withSystemScope } from '@guaranix/db';
import { telegramLinkCodes, telegramLinks } from '@guaranix/db/schema';
import { parseTelegramStart } from '@guaranix/messaging';
import { t } from '@guaranix/shared';
import { and, eq, gt, ne } from 'drizzle-orm';
import { sha256 } from '../../lib/crypto';
import type { NotificationChannels } from './queue';

type Reply = 'linked' | 'invalidCode' | 'help';

async function linkChat(
  database: SchemaDatabase,
  start: { chatId: string; code: string; username: string | null },
  now: Date,
): Promise<Reply> {
  const codeHash = await sha256(start.code);
  return withSystemScope(database, async (transaction) => {
    // Delete first: a code works once even if two webhooks race.
    const [used] = await transaction
      .delete(telegramLinkCodes)
      .where(and(eq(telegramLinkCodes.codeHash, codeHash), gt(telegramLinkCodes.expiresAt, now)))
      .returning({ userId: telegramLinkCodes.userId });
    if (!used) return 'invalidCode';
    // One chat, one person: a chat linked before to another account moves here.
    await transaction
      .delete(telegramLinks)
      .where(and(eq(telegramLinks.chatId, start.chatId), ne(telegramLinks.userId, used.userId)));
    await transaction
      .insert(telegramLinks)
      .values({ userId: used.userId, chatId: start.chatId, username: start.username })
      .onConflictDoUpdate({
        target: telegramLinks.userId,
        set: { chatId: start.chatId, username: start.username },
      });
    return 'linked';
  });
}

/**
 * A Telegram webhook update (already authenticated by its secret header).
 * Handles `/start <code>` from the panel's link and ignores everything else.
 */
export async function handleTelegramUpdate(
  database: SchemaDatabase,
  channels: NotificationChannels,
  update: unknown,
  now: Date,
): Promise<Reply | null> {
  const start = parseTelegramStart(update);
  if (!start) return null;
  const reply = start.code ? await linkChat(database, { ...start, code: start.code }, now) : 'help';
  try {
    await channels.telegram?.send(
      { channel: 'telegram', chatId: start.chatId },
      { title: '', body: t(`notifications.telegram.${reply}`) },
    );
  } catch {
    // The link is saved either way; the confirmation is a courtesy.
  }
  return reply;
}
