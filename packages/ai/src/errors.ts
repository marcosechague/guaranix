export const AI_ERROR_CODES = [
  /** The key is wrong, revoked or lacks access to the model. */
  'auth',
  'rate_limited',
  /** Provider down, timeout or network failure: worth retrying later. */
  'unavailable',
  /** The provider rejected the request (model name, file too large…). */
  'bad_request',
  /** A safety filter declined to answer. */
  'refused',
  /** The answer hit the output limit before the JSON was complete. */
  'truncated',
  /** The answer was not valid JSON or did not match the schema. */
  'invalid_output',
] as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

/**
 * Provider-neutral failure. The message never carries the API key or the
 * user's data, so it is safe to log.
 */
export class AiProviderError extends Error {
  constructor(
    readonly code: AiErrorCode,
    readonly status?: number,
  ) {
    super(`AI provider error: ${code}${status ? ` (${status})` : ''}`);
    this.name = 'AiProviderError';
  }
}

export function errorForStatus(status: number): AiProviderError {
  if (status === 401 || status === 403) return new AiProviderError('auth', status);
  if (status === 429) return new AiProviderError('rate_limited', status);
  if (status >= 500 || status === 408) return new AiProviderError('unavailable', status);
  return new AiProviderError('bad_request', status);
}

export function parseJsonOutput(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new AiProviderError('invalid_output');
  }
}
