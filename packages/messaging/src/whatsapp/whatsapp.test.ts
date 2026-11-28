import { describe, expect, it } from 'vitest';
import { createWhatsAppCloudChannel } from './whatsapp-cloud-channel';

const address = { channel: 'whatsapp' as const, phone: '+595981123456' };
const message = {
  title: 'Cuota por vencer',
  body: 'Tu cuota vence el 1/12',
  whatsappTemplate: { name: 'cuota_por_vencer', language: 'es', parameters: ['Ana', 'Box X'] },
};

function metaReplying(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const channel = createWhatsAppCloudChannel({
    accessToken: 'EAAtoken',
    phoneNumberId: '1098765',
    fetch: async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify(body), { status });
    },
  });
  return { channel, calls };
}

describe('createWhatsAppCloudChannel', () => {
  it('sends the approved template with its parameters', async () => {
    const { channel, calls } = metaReplying(200, { messages: [{ id: 'wamid.1' }] });
    await expect(channel.send(address, message)).resolves.toEqual({ providerMessageId: 'wamid.1' });
    expect(calls[0]?.url).toBe('https://graph.facebook.com/v23.0/1098765/messages');
    expect(new Headers(calls[0]?.init.headers).get('authorization')).toBe('Bearer EAAtoken');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '595981123456',
      type: 'template',
      template: {
        name: 'cuota_por_vencer',
        language: { code: 'es' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'Ana' },
              { type: 'text', text: 'Box X' },
            ],
          },
        ],
      },
    });
  });

  it('refuses a message without a template', async () => {
    const { channel, calls } = metaReplying(200, {});
    await expect(channel.send(address, { title: 't', body: 'b' })).rejects.toMatchObject({
      kind: 'permanent',
      code: 'whatsapp_template_missing',
    });
    expect(calls).toHaveLength(0);
  });

  it.each([
    [400, 131056, 'retryable'],
    [429, 130429, 'retryable'],
    [400, 131026, 'address_gone'],
    [401, 190, 'permanent'],
    [500, undefined, 'retryable'],
  ])('maps HTTP %i with Meta code %s to %s', async (status, code, kind) => {
    const { channel } = metaReplying(status, { error: { code } });
    await expect(channel.send(address, message)).rejects.toMatchObject({ kind });
  });
});
