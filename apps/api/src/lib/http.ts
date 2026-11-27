import type { AuthErrorCode } from '@guaranix/shared';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { z } from 'zod';
import type { AppEnv } from '../env';

export function fail(context: Context, status: ContentfulStatusCode, code: AuthErrorCode) {
  return context.json({ error: code }, status);
}

/** Parses the JSON body with a shared Zod schema; null when it is missing or invalid. */
export async function readBody<Schema extends z.ZodType>(
  context: Context<AppEnv>,
  schema: Schema,
): Promise<z.infer<Schema> | null> {
  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    return null;
  }
  const result = schema.safeParse(body);
  return result.success ? result.data : null;
}

/** Cloudflare sets this header; locally it is absent. */
export function clientIp(context: Context<AppEnv>): string | null {
  return context.req.header('cf-connecting-ip') ?? null;
}

export function allowedOrigins(context: Context<AppEnv>): string[] {
  return context.env.ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
