import {
  AUTH_ERROR_CODES,
  type AuthConfig,
  type AuthErrorCode,
  type ForgotPasswordInput,
  type LoginInput,
  type ResetPasswordInput,
  type Session,
  type SetPasswordInput,
  type SignupInput,
} from '../schemas/auth';

export class AuthApiError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    readonly status: number,
  ) {
    super(code);
    this.name = 'AuthApiError';
  }
}

export type GoogleIntent = 'login' | 'link';

export interface AuthClientOptions {
  /** API origin, e.g. `http://localhost:8787`. */
  baseUrl: string;
  fetch?: typeof fetch;
}

function toErrorCode(value: unknown): AuthErrorCode {
  return (AUTH_ERROR_CODES as readonly unknown[]).includes(value)
    ? (value as AuthErrorCode)
    : 'internal_error';
}

/**
 * Talks to the API's `/auth` routes with the session cookie. It remembers the
 * CSRF token from the last session response and sends it on every write.
 */
export function createAuthClient({ baseUrl, fetch: fetchImpl = fetch }: AuthClientOptions) {
  let csrfToken: string | null = null;

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (method !== 'GET' && csrfToken) headers['x-csrf-token'] = csrfToken;
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers,
      credentials: 'include',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload: unknown = response.status === 204 ? null : await response.json();
    if (!response.ok) {
      const code = (payload as { error?: unknown } | null)?.error;
      throw new AuthApiError(toErrorCode(code), response.status);
    }
    return payload as T;
  }

  async function sessionRequest(method: string, path: string, body?: unknown) {
    const session = await request<Session>(method, path, body);
    csrfToken = session.csrfToken;
    return session;
  }

  return {
    /** Current session, or null when logged out. */
    async getSession(): Promise<Session | null> {
      try {
        return await sessionRequest('GET', '/auth/session');
      } catch (error) {
        if (error instanceof AuthApiError && error.status === 401) return null;
        throw error;
      }
    },
    getConfig: () => request<AuthConfig>('GET', '/auth/config'),
    signup: (input: SignupInput) => sessionRequest('POST', '/auth/signup', input),
    login: (input: LoginInput) => sessionRequest('POST', '/auth/login', input),
    forgotPassword: (input: ForgotPasswordInput) =>
      request<{ status: 'sent' }>('POST', '/auth/password/forgot', input),
    resetPassword: (input: ResetPasswordInput) =>
      sessionRequest('POST', '/auth/password/reset', input),
    setPassword: (input: SetPasswordInput) => sessionRequest('POST', '/auth/password', input),
    selectBox: (boxId: string) => sessionRequest('POST', '/auth/session/box', { boxId }),
    unlinkGoogle: () => sessionRequest('DELETE', '/auth/google'),
    async logout(): Promise<void> {
      await request<null>('POST', '/auth/logout');
      csrfToken = null;
    },
    /** Full-page navigation to Google; it comes back to `returnTo`. */
    googleUrl(intent: GoogleIntent, returnTo: string): string {
      const params = new URLSearchParams({ intent, returnTo });
      return `${baseUrl}/auth/google/start?${params.toString()}`;
    },
  };
}

export type AuthClient = ReturnType<typeof createAuthClient>;
