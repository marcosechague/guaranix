import { expect } from 'vitest';
import { ServiceError } from '../services/errors';

/** Asserts that `work` fails with a ServiceError carrying `code`. */
export async function expectServiceError(work: Promise<unknown>, code: string): Promise<void> {
  const error = await work.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(ServiceError);
  expect((error as ServiceError).code).toBe(code);
}
