import { rowsOf, type SchemaDatabase, withSystemScope } from '@guaranix/db';
import { sql } from 'drizzle-orm';
import { hmacSha256 } from '../lib/crypto';

export interface RateLimitRule {
  name: string;
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  loginByIp: { name: 'login:ip', limit: 30, windowSeconds: 15 * 60 },
  loginByEmail: { name: 'login:email', limit: 10, windowSeconds: 15 * 60 },
  signupByIp: { name: 'signup:ip', limit: 10, windowSeconds: 60 * 60 },
  forgotByIp: { name: 'forgot:ip', limit: 10, windowSeconds: 60 * 60 },
  forgotByEmail: { name: 'forgot:email', limit: 3, windowSeconds: 60 * 60 },
  resetByIp: { name: 'reset:ip', limit: 20, windowSeconds: 15 * 60 },
  passwordChangeByUser: { name: 'password:user', limit: 10, windowSeconds: 15 * 60 },
  boxSignupByUser: { name: 'box-signup:user', limit: 3, windowSeconds: 24 * 60 * 60 },
  paymentLinkByIp: { name: 'payment-link:ip', limit: 60, windowSeconds: 15 * 60 },
} as const satisfies Record<string, RateLimitRule>;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Counts one hit for `subject` (an IP, an email or a user id) in a fixed window
 * kept in Postgres, so every Worker instance shares it. The key is an HMAC, so
 * the table never stores the raw IP or email.
 */
export async function consumeRateLimit(
  database: SchemaDatabase,
  secret: string,
  rule: RateLimitRule,
  subject: string,
): Promise<RateLimitResult> {
  const key = `${rule.name}:${await hmacSha256(secret, `${rule.name}:${subject}`)}`;
  const window = sql`make_interval(secs => ${rule.windowSeconds})`;
  const result = await withSystemScope(database, (transaction) =>
    transaction.execute(sql`
      insert into rate_limit_counters (key, window_started_at, hits)
      values (${key}, now(), 1)
      on conflict (key) do update set
        hits = case when rate_limit_counters.window_started_at <= now() - ${window}
          then 1 else rate_limit_counters.hits + 1 end,
        window_started_at = case when rate_limit_counters.window_started_at <= now() - ${window}
          then now() else rate_limit_counters.window_started_at end
      returning hits,
        ceil(extract(epoch from (window_started_at + ${window} - now())))::int as retry_after`),
  );
  const [row] = rowsOf<{ hits: number; retry_after: number }>(result);
  if (!row) throw new Error('Rate limit counter did not return a row');
  return { allowed: row.hits <= rule.limit, retryAfterSeconds: Math.max(1, row.retry_after) };
}
