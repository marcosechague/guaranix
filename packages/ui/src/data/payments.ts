import type { ApiClient } from '@guaranix/shared/api';
import type { Payment } from '@guaranix/shared/api';
import type { RecordPaymentInput } from '@guaranix/shared/schemas';

/**
 * Uploads the receipt first, when there is one, then records the payment
 * with the key the API gave it. Shared by the front desk and the member app.
 */
export async function recordPaymentWithReceipt(
  api: ApiClient,
  input: RecordPaymentInput,
  receipt: File | null,
): Promise<Payment> {
  const receiptFileKey = receipt
    ? (await api.upload<{ fileKey: string }>('/box/receipts', receipt)).fileKey
    : null;
  return (await api.post<{ payment: Payment }>('/box/payments', { ...input, receiptFileKey }))
    .payment;
}
