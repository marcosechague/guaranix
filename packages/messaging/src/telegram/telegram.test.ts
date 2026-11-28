import { describe, expect, it } from 'vitest';
import { createTelegramChannel } from './telegram-channel';
import { parseTelegramStart } from './telegram-update';

const address = { channel: 'telegram' as const, chatId: '12345' };

function telegramReplying(status: number, body: unknown) {
  const calls: { url: string; body: unknown }[] = [];
  const channel = createTelegramChannel({
    botToken: '123:abc',
    fetch: async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify(body), { status });
    },
  });
  return { channel, calls };
}

describe('createTelegramChannel', () => {
  it('sends plain text to the chat', async () => {
    const { channel, calls } = telegramReplying(200, { ok: true, result: { message_id: 77 } });
    const result = await channel.send(address, {
      title: 'Clase cancelada',
      body: 'WOD 07:00 de mañana',
      url: 'https://panel.example.com/clases',
    });
    expect(result.providerMessageId).toBe('77');
    expect(calls[0]?.url).toBe('https://api.telegram.org/bot123:abc/sendMessage');
    expect(calls[0]?.body).toEqual({
      chat_id: '12345',
      text: 'Clase cancelada\n\nWOD 07:00 de mañana\n\nhttps://panel.example.com/clases',
      link_preview_options: { is_disabled: true },
    });
  });

  it('retries after what Telegram asks on a rate limit', async () => {
    const { channel } = telegramReplying(429, {
      ok: false,
      error_code: 429,
      parameters: { retry_after: 12 },
    });
    await expect(channel.send(address, { title: 't', body: 'b' })).rejects.toMatchObject({
      kind: 'retryable',
      retryAfterSeconds: 12,
    });
  });

  it('drops the chat when the user blocked the bot', async () => {
    const { channel } = telegramReplying(403, { ok: false, error_code: 403 });
    await expect(channel.send(address, { title: 't', body: 'b' })).rejects.toMatchObject({
      kind: 'address_gone',
      code: 'telegram_403',
    });
  });

  it('never puts the token in the error', async () => {
    const { channel } = telegramReplying(401, { ok: false, error_code: 401 });
    const error = await channel.send(address, { title: 't', body: 'b' }).catch((e: unknown) => e);
    expect(String(error)).not.toContain('123:abc');
    expect(error).toMatchObject({ kind: 'permanent' });
  });
});

describe('parseTelegramStart', () => {
  const update = (text: string, type = 'private') => ({
    message: { text, chat: { id: 42, type }, from: { username: 'coach_ana' } },
  });

  it('reads the link code from /start', () => {
    expect(parseTelegramStart(update('/start Ab_9-x'))).toEqual({
      chatId: '42',
      code: 'Ab_9-x',
      username: 'coach_ana',
    });
  });

  it('accepts /start without a code', () => {
    expect(parseTelegramStart(update('/start'))?.code).toBeNull();
  });

  it('ignores groups, other commands and junk', () => {
    expect(parseTelegramStart(update('/start abc', 'group'))).toBeNull();
    expect(parseTelegramStart(update('hola'))).toBeNull();
    expect(parseTelegramStart(update('/start a b'))).toBeNull();
    expect(parseTelegramStart(null)).toBeNull();
    expect(parseTelegramStart({ edited_message: {} })).toBeNull();
  });
});
