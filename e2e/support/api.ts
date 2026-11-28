import { request, type APIRequestContext } from '@playwright/test';
import { APPS, DEMO } from './apps';

/**
 * A logged-in API client for setting the stage (opening bookings further
 * ahead, filling a class) without clicking through screens that other tests
 * already cover. It sends what a browser sends: Origin and the CSRF token.
 */
export interface StaffApi {
  get<T>(path: string): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
  dispose(): Promise<void>;
}

export async function apiAs(email: string, origin: string = APPS.admin): Promise<StaffApi> {
  const context: APIRequestContext = await request.newContext({
    baseURL: APPS.api,
    extraHTTPHeaders: { origin },
  });
  const login = await context.post('/auth/login', {
    data: { email, password: DEMO.password },
  });
  if (!login.ok()) throw new Error(`Login as ${email} failed: ${login.status()}`);
  const { csrfToken } = (await login.json()) as { csrfToken: string };
  const parse = async <T>(response: Awaited<ReturnType<APIRequestContext['get']>>) => {
    if (!response.ok()) {
      throw new Error(`${response.url()} answered ${response.status()}: ${await response.text()}`);
    }
    return (await response.json()) as T;
  };
  return {
    get: async (path) => parse(await context.get(path)),
    patch: async (path, body) =>
      parse(await context.patch(path, { data: body, headers: { 'x-csrf-token': csrfToken } })),
    dispose: () => context.dispose(),
  };
}
