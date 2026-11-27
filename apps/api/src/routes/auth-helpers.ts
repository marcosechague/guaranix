import type { Context } from 'hono';
import type { AppEnv } from '../env';
import { writeSessionCookie } from '../lib/cookies';
import { clientIp, fail } from '../lib/http';
import { consumeRateLimit, type RateLimitRule } from '../services/rate-limit';
import { describeSession } from '../services/sessions';

/** Returns a 429 response when the limit is spent, otherwise null. */
export async function rateLimited(
  context: Context<AppEnv>,
  rule: RateLimitRule,
  subject: string,
): Promise<Response | null> {
  const result = await consumeRateLimit(
    context.var.services.database(),
    context.env.AUTH_SECRET,
    rule,
    subject,
  );
  if (result.allowed) return null;
  context.header('retry-after', String(result.retryAfterSeconds));
  return fail(context, 429, 'rate_limited');
}

export function ipSubject(context: Context<AppEnv>): string {
  return clientIp(context) ?? 'unknown';
}

/** Null when the captcha passed or is off (development without Turnstile keys). */
export async function captchaFailed(
  context: Context<AppEnv>,
  token: string | undefined,
): Promise<Response | null> {
  const captcha = context.var.services.captcha;
  if (!captcha) return null;
  const passed = token ? await captcha.verify(token, clientIp(context)) : false;
  return passed ? null : fail(context, 400, 'captcha_failed');
}

/** Sets the session cookie and answers with what the app needs to render. */
export async function respondWithSession(context: Context<AppEnv>, token: string) {
  writeSessionCookie(context, token);
  const session = await describeSession(
    context.var.services.database(),
    context.env.AUTH_SECRET,
    token,
  );
  if (!session) throw new Error('Session vanished right after it was created');
  return context.json(session);
}
