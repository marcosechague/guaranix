import { AiProviderError, errorForStatus } from '../errors';

const REQUEST_TIMEOUT_MS = 120_000;

/** POST for the adapters without an SDK. Maps transport failures to provider-neutral errors. */
export async function postJson(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new AiProviderError('unavailable');
  }
  // The error body may echo request details; it is dropped, only the status matters.
  if (!response.ok) throw errorForStatus(response.status);
  try {
    return await response.json();
  } catch {
    throw new AiProviderError('unavailable', response.status);
  }
}

export const dataUrl = (mediaType: string, data: string) => `data:${mediaType};base64,${data}`;
