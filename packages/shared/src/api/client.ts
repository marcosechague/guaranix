export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

export interface ApiClientOptions {
  /** API origin, e.g. `http://localhost:8787`. */
  baseUrl: string;
  /** Read on every write so a refreshed session token is always used. */
  getCsrfToken: () => string | null;
  fetch?: typeof fetch;
}

type Query = Readonly<Record<string, string | number | undefined>>;

function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

/** JSON client for the box routes, with the session cookie and CSRF header. */
export function createApiClient({ baseUrl, getCsrfToken, fetch: fetchImpl }: ApiClientOptions) {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    const csrfToken = getCsrfToken();
    if (method !== 'GET' && csrfToken) headers['x-csrf-token'] = csrfToken;
    const response = await (fetchImpl ?? fetch)(`${baseUrl}${path}`, {
      method,
      headers,
      credentials: 'include',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload: unknown =
      response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      const code = (payload as { error?: unknown } | null)?.error;
      throw new ApiError(typeof code === 'string' ? code : 'internal_error', response.status);
    }
    return payload as T;
  }

  return {
    get: <T>(path: string, query?: Query) => request<T>('GET', withQuery(path, query)),
    post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
    patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
    delete: <T>(path: string) => request<T>('DELETE', path),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
