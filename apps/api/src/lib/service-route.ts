import { idSchema } from '@guaranix/shared';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { z } from 'zod';
import type { BoxEnv } from '../middleware/box-scope';
import type { ServiceContext } from '../services/context';
import { ServiceError } from '../services/errors';

type BoxContext = Context<BoxEnv>;

const invalidInput = () => new ServiceError(400, 'invalid_input');

export function serviceContext(context: BoxContext): ServiceContext {
  return { transaction: context.var.transaction, auth: context.var.auth, now: new Date() };
}

/**
 * Runs a service and answers with its result as JSON, or with
 * `{ error: code }` when it breaks a business rule. Any error response rolls
 * the request's transaction back (see `createBoxRouter`).
 */
export async function respond(
  context: BoxContext,
  work: (service: ServiceContext) => Promise<unknown>,
  status: ContentfulStatusCode = 200,
) {
  try {
    const result = await work(serviceContext(context));
    return context.json(result as object, status);
  } catch (error) {
    if (error instanceof ServiceError) return context.json({ error: error.code }, error.status);
    throw error;
  }
}

export async function parseBody<Schema extends z.ZodType>(
  context: BoxContext,
  schema: Schema,
  extra: Record<string, unknown> = {},
): Promise<z.output<Schema>> {
  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    throw invalidInput();
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw invalidInput();
  const result = schema.safeParse({ ...body, ...extra });
  if (!result.success) throw invalidInput();
  return result.data;
}

export function parseQuery<Schema extends z.ZodType>(
  context: BoxContext,
  schema: Schema,
): z.output<Schema> {
  const result = schema.safeParse(context.req.query());
  if (!result.success) throw invalidInput();
  return result.data;
}

/** Path ids that are not UUIDs can't exist, so they get the same 404 as a missing row. */
export function idParam(context: BoxContext, name: string, entity: string): string {
  const result = idSchema.safeParse(context.req.param(name));
  if (!result.success) throw new ServiceError(404, `${entity}_not_found`);
  return result.data;
}
