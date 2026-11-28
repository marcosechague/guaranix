import type { PaymentProviderEnvironment } from '@guaranix/shared/domain';
import { PaymentProviderError } from '../../errors';

const BASE_URLS: Record<PaymentProviderEnvironment, string> = {
  sandbox: 'https://vpos.infonet.com.py:8888',
  production: 'https://vpos.infonet.com.py',
};

/** Bancard's iframe script. Confirm the version with the docs Bancard sends with the keys. */
const CHECKOUT_SCRIPT_PATH = '/checkout/javascript/dist/bancard-checkout-4.0.0.js';

const TIMEOUT_MS = 20_000;

const AUTH_ERRORS = new Set(['InvalidPublicKeyError', 'InvalidTokenError', 'UnauthorizedError']);

export interface BancardMessage {
  key?: string;
  level?: string;
  dsc?: string;
}

export interface BancardResponse {
  status?: string;
  messages?: BancardMessage[];
  [field: string]: unknown;
}

export const bancardBaseUrl = (environment: PaymentProviderEnvironment) => BASE_URLS[environment];

export const bancardScriptUrl = (environment: PaymentProviderEnvironment) =>
  `${BASE_URLS[environment]}${CHECKOUT_SCRIPT_PATH}`;

/** The first error key Bancard sent, e.g. `PaymentNotFoundError`. */
export const errorKeyOf = (response: BancardResponse) =>
  response.messages?.find((message) => message.key)?.key;

/**
 * One call to the vPOS API. Network failures, timeouts and 5xx are
 * `unavailable` (the result is unknown); Bancard's own errors come back as a
 * response with `status: "error"` for the caller to read.
 */
export async function callBancard(options: {
  environment: PaymentProviderEnvironment;
  publicKey: string;
  method: 'POST' | 'DELETE';
  path: string;
  operation: Record<string, unknown>;
  fetchImpl: typeof fetch;
}): Promise<BancardResponse> {
  let response: Response;
  try {
    response = await options.fetchImpl(
      `${BASE_URLS[options.environment]}/vpos/api/0.3/${options.path}`,
      {
        method: options.method,
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ public_key: options.publicKey, operation: options.operation }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
  } catch {
    throw new PaymentProviderError('unavailable');
  }
  if (response.status >= 500 || response.status === 408 || response.status === 429) {
    throw new PaymentProviderError('unavailable', String(response.status));
  }
  let body: BancardResponse;
  try {
    body = (await response.json()) as BancardResponse;
  } catch {
    throw new PaymentProviderError('unavailable', 'invalid_json');
  }
  const key = errorKeyOf(body);
  if (response.status === 401 || response.status === 403 || (key && AUTH_ERRORS.has(key))) {
    throw new PaymentProviderError('auth', key);
  }
  return body;
}

/** For answers that must be `success`; anything else is the request's fault. */
export function expectSuccess(body: BancardResponse): BancardResponse {
  if (body.status !== 'success') {
    throw new PaymentProviderError('bad_request', errorKeyOf(body) ?? 'unknown');
  }
  return body;
}
