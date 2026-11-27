/**
 * A rule the request broke. Routes turn it into `{ error: code }` with this
 * status; the code is a stable key the frontend translates.
 */
export class ServiceError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409 | 422,
    readonly code: string,
  ) {
    super(code);
    this.name = 'ServiceError';
  }
}

export const notFound = (entity: string) => new ServiceError(404, `${entity}_not_found`);
export const forbidden = () => new ServiceError(403, 'forbidden');
export const conflict = (code: string) => new ServiceError(409, code);
export const unprocessable = (code: string) => new ServiceError(422, code);

const UNIQUE_VIOLATION = '23505';

/** Postgres error code, whether the driver error is raw or wrapped by Drizzle. */
function postgresCode(error: unknown): string | undefined {
  for (let current = error; current && typeof current === 'object';) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string') return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

export function isUniqueViolation(error: unknown): boolean {
  return postgresCode(error) === UNIQUE_VIOLATION;
}
