/**
 * - `retryable`: try again later (rate limit, provider down, network).
 * - `address_gone`: the address no longer works (push subscription expired,
 *   bot blocked, number not on WhatsApp); stop using it.
 * - `permanent`: retrying won't help (bad configuration, rejected message).
 */
export type ChannelErrorKind = 'retryable' | 'address_gone' | 'permanent';

/**
 * Neutral error every channel adapter throws. The message carries only the
 * provider status or error code, never tokens, addresses or message text.
 */
export class ChannelError extends Error {
  override readonly name = 'ChannelError';

  constructor(
    readonly kind: ChannelErrorKind,
    /** Short code for logs and the delivery row, e.g. `http_429`, `telegram_403`. */
    readonly code: string,
    /** Provider hint, when it sends one (Telegram `retry_after`, HTTP `Retry-After`). */
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(`Channel error ${code} (${kind})`);
  }
}

/** HTTP statuses every provider treats as "try again later". */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/** Seconds from a `Retry-After` header (seconds form only; dates are rare here). */
export function retryAfterHeader(response: Response): number | null {
  const value = Number(response.headers.get('retry-after'));
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : null;
}

/** A fetch that never reached the provider is always worth retrying. */
export async function fetchOrRetryable(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetchImpl(url, init);
  } catch {
    throw new ChannelError('retryable', 'network');
  }
}
