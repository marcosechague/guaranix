import { describe, expect, it } from 'vitest';
import { createConsoleChannel } from './console-channel';
import { createMemoryChannel } from './memory-channel';

describe('createConsoleChannel', () => {
  it('prints the message and template in development', async () => {
    const lines: string[] = [];
    const channel = createConsoleChannel('whatsapp', 'development', (line) => lines.push(line));
    await channel.send(
      { channel: 'whatsapp', phone: '+595981000000' },
      {
        title: 'Cuota',
        body: 'Vence mañana',
        whatsappTemplate: { name: 'cuota', language: 'es', parameters: ['Ana'] },
      },
    );
    expect(lines[0]).toContain('[dev whatsapp] whatsapp phone=+595981000000 template=cuota(Ana)');
  });

  it('refuses to run outside development', () => {
    expect(() => createConsoleChannel('push', 'production')).toThrow(/only allowed in development/);
  });
});

describe('createMemoryChannel', () => {
  it('records sends and fails on demand', async () => {
    const channel = createMemoryChannel<{ channel: 'telegram'; chatId: string }>('telegram');
    channel.failNext(new Error('down'));
    await expect(
      channel.send({ channel: 'telegram', chatId: '1' }, { title: 't', body: 'b' }),
    ).rejects.toThrow('down');
    await channel.send({ channel: 'telegram', chatId: '1' }, { title: 't', body: 'b' });
    expect(channel.sent).toHaveLength(1);
  });
});
