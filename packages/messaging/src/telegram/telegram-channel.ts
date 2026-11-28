import type {
  NotificationChannel,
  OutgoingMessage,
  SendResult,
  TelegramAddress,
} from '../notifications/channel';
import { ChannelError, fetchOrRetryable, isRetryableStatus } from '../notifications/channel-error';

export interface TelegramOptions {
  /** From @BotFather. A Worker secret: it also appears in the request URL, so never log URLs. */
  botToken: string;
  fetch?: typeof fetch;
}

interface TelegramResponse {
  ok: boolean;
  result?: { message_id?: number };
  error_code?: number;
  parameters?: { retry_after?: number };
}

/** Plain text (no Markdown) so a box or member name can never break the formatting. */
export function telegramText(message: OutgoingMessage): string {
  return [message.title, message.body, message.url].filter(Boolean).join('\n\n');
}

async function readTelegramResponse(response: Response): Promise<TelegramResponse> {
  try {
    return (await response.json()) as TelegramResponse;
  } catch {
    return { ok: false, error_code: response.status };
  }
}

/** Telegram Bot API `sendMessage`. Free, so it carries internal notices for staff. */
export function createTelegramChannel({
  botToken,
  fetch: fetchImpl = fetch,
}: TelegramOptions): NotificationChannel<TelegramAddress> {
  return {
    channel: 'telegram',
    async send(address: TelegramAddress, message: OutgoingMessage): Promise<SendResult> {
      const response = await fetchOrRetryable(
        fetchImpl,
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            chat_id: address.chatId,
            text: telegramText(message),
            link_preview_options: { is_disabled: true },
          }),
        },
      );
      const json = await readTelegramResponse(response);
      if (response.ok && json.ok) {
        const id = json.result?.message_id;
        return { providerMessageId: id === undefined ? null : String(id) };
      }
      const status = json.error_code ?? response.status;
      const code = `telegram_${status}`;
      if (isRetryableStatus(status)) {
        throw new ChannelError('retryable', code, json.parameters?.retry_after ?? null);
      }
      // 403: the user blocked the bot. 400 is almost always "chat not found".
      if (status === 403 || status === 400) throw new ChannelError('address_gone', code);
      throw new ChannelError('permanent', code);
    },
  };
}
