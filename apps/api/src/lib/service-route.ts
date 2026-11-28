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
export function respond(
  context: BoxContext,
  work: (service: ServiceContext) => Promise<unknown>,
  status: ContentfulStatusCode = 200,
) {
  return respondWith(context, () => work(serviceContext(context)), status);
}

/** `respond` for routers that build their own service context (platform). */
export async function respondWith(
  context: Context,
  work: () => Promise<unknown>,
  status: ContentfulStatusCode = 200,
) {
  try {
    const result = await work();
    return context.json(result as object, status);
  } catch (error) {
    if (error instanceof ServiceError) return context.json({ error: error.code }, error.status);
    throw error;
  }
}

export async function parseBody<Schema extends z.ZodType>(
  context: Context,
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
  context: Context,
  schema: Schema,
): z.output<Schema> {
  const result = schema.safeParse(context.req.query());
  if (!result.success) throw invalidInput();
  return result.data;
}

/** Path ids that are not UUIDs can't exist, so they get the same 404 as a missing row. */
export function idParam(context: Context, name: string, entity: string): string {
  const result = idSchema.safeParse(context.req.param(name));
  if (!result.success) throw new ServiceError(404, `${entity}_not_found`);
  return result.data;
}

/** A path parameter checked against a schema; anything else is a 404 for `entity`. */
export function parseParam<Schema extends z.ZodType>(
  context: Context,
  name: string,
  schema: Schema,
  entity: string,
): z.output<Schema> {
  const result = schema.safeParse(context.req.param(name));
  if (!result.success) throw new ServiceError(404, `${entity}_not_found`);
  return result.data;
}

/**
 * A raw file upload, read chunk by chunk and cut off as soon as it passes
 * `maxBytes`, so an oversized body is never buffered whole, with or without a
 * Content-Length. Services still check the real bytes.
 */
export async function readUpload(
  context: Context,
  maxBytes: number,
  tooLargeCode: string,
): Promise<ArrayBuffer> {
  const tooLarge = () => new ServiceError(422, tooLargeCode);
  const declared = context.req.header('content-length');
  if (declared !== undefined && !/^\d+$/.test(declared)) throw invalidInput();
  if (declared !== undefined && Number(declared) > maxBytes) throw tooLarge();
  const body = context.req.raw.body;
  if (!body) return new ArrayBuffer(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}
