import { describe, expect, it } from 'vitest';
import {
  MOCK_SIGNATURE_HEADER,
  createMockPaymentProvider,
  signMockWebhook,
} from '../providers/mock';

describe('mock provider', () => {
  const provider = createMockPaymentProvider({ privateKey: 'dev-key' });

  it('approves by default and declines amounts ending in 13', async () => {
    const base = { customerRef: '1', cardRef: '2', orderNumber: 3, description: 'x' };
    expect((await provider.chargeCard({ ...base, amountGs: 300_000 })).status).toBe('approved');
    expect((await provider.chargeCard({ ...base, amountGs: 300_013 })).status).toBe('declined');
  });

  it('only accepts webhooks signed with the account key', async () => {
    const payload = { orderNumber: 9, approved: true, amountGs: 1000 };
    const { body, signature } = await signMockWebhook('dev-key', payload);
    const event = await provider.parseWebhook({
      body,
      headers: new Headers({ [MOCK_SIGNATURE_HEADER]: signature }),
    });
    expect(event.outcome.status).toBe('approved');
    const forged = await signMockWebhook('other-key', payload);
    await expect(
      provider.parseWebhook({
        body,
        headers: new Headers({ [MOCK_SIGNATURE_HEADER]: forged.signature }),
      }),
    ).rejects.toMatchObject({ code: 'invalid_signature' });
  });
});
