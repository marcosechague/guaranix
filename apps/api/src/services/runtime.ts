import { createDatabase, type Database } from '@guaranix/db';
import {
  createConsoleEmailSender,
  createResendEmailSender,
  type EmailSender,
} from '@guaranix/messaging';
import type { Bindings, Services } from '../env';
import { createTurnstileVerifier } from '../integrations/captcha';
import { createGoogleOAuth } from '../integrations/google-oauth';

const REQUIRED_OUTSIDE_DEVELOPMENT = [
  'AUTH_SECRET',
  'TURNSTILE_SITE_KEY',
  'TURNSTILE_SECRET_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'RESEND_API_KEY',
  'EMAIL_FROM',
] as const satisfies (keyof Bindings)[];

/**
 * Development may skip captcha, Google and Resend so login works with no
 * accounts set up. Staging and production fail closed: a missing key stops
 * every request instead of silently turning protection off.
 */
export function assertProductionConfig(env: Bindings): void {
  if (env.APP_ENV === 'development') return;
  const missing = REQUIRED_OUTSIDE_DEVELOPMENT.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
}

function connectionString(env: Bindings): string {
  const url = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
  if (!url) throw new Error('No database: bind HYPERDRIVE or set DATABASE_URL in .dev.vars');
  return url;
}

function emailSenderFor(env: Bindings): EmailSender {
  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
    return createResendEmailSender({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM });
  }
  // Only reachable in development: assertProductionConfig requires Resend elsewhere.
  return createConsoleEmailSender(env.APP_ENV);
}

/** Real integrations for one request. Returns `close` to release the database client. */
export function createRuntimeServices(env: Bindings): {
  services: Services;
  close(): Promise<void>;
} {
  assertProductionConfig(env);
  let database: Database | undefined;
  const services: Services = {
    database() {
      database ??= createDatabase(connectionString(env));
      return database;
    },
    emailSender: emailSenderFor(env),
    captcha: env.TURNSTILE_SECRET_KEY ? createTurnstileVerifier(env.TURNSTILE_SECRET_KEY) : null,
    google:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? createGoogleOAuth(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET)
        : null,
  };
  return {
    services,
    close: async () => {
      if (database) await database.$client.end();
    },
  };
}
