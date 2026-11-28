import { mkdirSync } from 'node:fs';
import { request } from '@playwright/test';
import { APPS, DEMO } from './apps';
import { AUTH_DIR, SIGNED_IN } from './sessions';

/**
 * Logs each demo account in once and saves its cookies, so the tests reuse
 * the session instead of logging in again and again (the API locks an email
 * after 10 attempts in 15 minutes). The real login form has its own test.
 */
export default async function globalSetup() {
  mkdirSync(AUTH_DIR, { recursive: true });
  for (const [role, file] of Object.entries(SIGNED_IN)) {
    const email = DEMO[role as keyof typeof SIGNED_IN];
    const context = await request.newContext({
      baseURL: APPS.api,
      extraHTTPHeaders: { origin: APPS.admin },
    });
    const response = await context.post('/auth/login', {
      data: { email, password: DEMO.password },
    });
    if (!response.ok()) throw new Error(`Could not log in ${email}: ${response.status()}`);
    await context.storageState({ path: file });
    await context.dispose();
  }
}
