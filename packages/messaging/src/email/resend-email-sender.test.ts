import { describe, expect, it } from 'vitest';
import { createResendEmailSender } from './resend-email-sender';

describe('createResendEmailSender', () => {
  it('posts the email to Resend with the API key', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const sender = createResendEmailSender({
      apiKey: 're_test',
      from: 'GuaraniX <no-responder@example.com>',
      fetch: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response('{}', { status: 200 });
      },
    });
    await sender.send({ to: 'ana@example.com', subject: 'Hola', text: 'Cuerpo' });
    expect(calls[0]?.url).toBe('https://api.resend.com/emails');
    expect(new Headers(calls[0]?.init.headers).get('authorization')).toBe('Bearer re_test');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      from: 'GuaraniX <no-responder@example.com>',
      to: ['ana@example.com'],
      subject: 'Hola',
      text: 'Cuerpo',
    });
  });

  it('throws when Resend rejects the email', async () => {
    const sender = createResendEmailSender({
      apiKey: 're_test',
      from: 'x@example.com',
      fetch: async () => new Response('{}', { status: 422 }),
    });
    await expect(sender.send({ to: 'a@b.co', subject: 's', text: 't' })).rejects.toThrow(/422/);
  });
});
