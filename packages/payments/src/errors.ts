export const PAYMENT_ERROR_CODES = [
  /** The keys are wrong or the commerce is not enabled. */
  'auth',
  /** Processor down, timeout or network failure: the result is unknown, ask again later. */
  'unavailable',
  /** The processor rejected the request itself (bad field, duplicate order…). */
  'bad_request',
  /** The webhook did not come from the processor. */
  'invalid_signature',
  /** The processor no longer allows it (e.g. a refund after the day closed). */
  'not_supported',
] as const;

export type PaymentErrorCode = (typeof PAYMENT_ERROR_CODES)[number];

/**
 * Provider-neutral failure. The message never carries keys or card data, so it
 * is safe to log. `detail` is the processor's own error key (e.g.
 * `InvalidTokenError`), never its free text.
 */
export class PaymentProviderError extends Error {
  constructor(
    readonly code: PaymentErrorCode,
    readonly detail?: string,
  ) {
    super(`Payment provider error: ${code}${detail ? ` (${detail})` : ''}`);
    this.name = 'PaymentProviderError';
  }
}
