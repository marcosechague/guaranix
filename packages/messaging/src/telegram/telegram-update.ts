/** The bits of a Telegram webhook update the API uses to link a chat. */
export interface TelegramStartCommand {
  chatId: string;
  /** Payload of `/start <code>`, from the `t.me/<bot>?start=<code>` deep link. */
  code: string | null;
  /** Telegram username, if the person has one; shown in settings. */
  username: string | null;
}

interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: { id?: number | string; type?: string };
    from?: { username?: string };
  };
}

/**
 * Reads a `/start` sent in a private chat with the bot, or null for any other
 * update. Group chats are ignored so a code shared in a group links nobody.
 */
export function parseTelegramStart(update: unknown): TelegramStartCommand | null {
  if (typeof update !== 'object' || update === null) return null;
  const message = (update as TelegramUpdate).message;
  const text = message?.text?.trim();
  const chatId = message?.chat?.id;
  if (!text || chatId === undefined || message?.chat?.type !== 'private') return null;
  const match = /^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]{1,64}))?$/.exec(text);
  if (!match) return null;
  return {
    chatId: String(chatId),
    code: match[1] ?? null,
    username: message.from?.username ?? null,
  };
}
