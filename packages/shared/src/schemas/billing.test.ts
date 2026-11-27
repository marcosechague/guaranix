import { describe, expect, it } from 'vitest';
import { recordPaymentSchema } from './billing';

const payment = {
  memberId: '018f3c1e-7d2a-7c3b-9a1e-2b3c4d5e6f70',
  amountGs: 350_000,
  paidAt: '2026-12-01T10:00:00-03:00',
};

describe('recordPaymentSchema', () => {
  it('accepts cash without a receipt', () => {
    expect(recordPaymentSchema.safeParse({ ...payment, method: 'cash' }).success).toBe(true);
  });

  it('requires a receipt for QR payments', () => {
    expect(recordPaymentSchema.safeParse({ ...payment, method: 'qr' }).success).toBe(false);
    const withReceipt = { ...payment, method: 'qr', receiptFileKey: 'receipts/abc.jpg' };
    expect(recordPaymentSchema.safeParse(withReceipt).success).toBe(true);
  });

  it('rejects zero and fractional amounts', () => {
    expect(recordPaymentSchema.safeParse({ ...payment, method: 'cash', amountGs: 0 }).success).toBe(
      false,
    );
    expect(
      recordPaymentSchema.safeParse({ ...payment, method: 'cash', amountGs: 10.5 }).success,
    ).toBe(false);
  });
});
