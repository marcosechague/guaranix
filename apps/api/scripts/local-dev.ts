/** Shared by the demo scripts: local settings and the guard that keeps them off shared databases. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertNoProductionEnv, readLocalDatabaseUrl } from '@guaranix/db';

/** `wrangler dev` reads `.dev.vars`; reading it here keeps one local secret. */
function devVars(): Record<string, string> {
  try {
    // pnpm runs package scripts from apps/api.
    const text = readFileSync(resolve(process.cwd(), '.dev.vars'), { encoding: 'utf8' });
    return Object.fromEntries(
      text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
    );
  } catch {
    return {};
  }
}

/**
 * `.dev.vars` wins over the shell, like it does for `wrangler dev`: a secret
 * exported in the shell (say, the production AUTH_SECRET) must not leak into
 * local demo data.
 */
export const localVars: Record<string, string | undefined> = { ...process.env, ...devVars() };

/** The local database URL; throws unless it points at this machine and the shell is a dev one. */
export function localDatabaseUrl(purpose: string): string {
  assertNoProductionEnv(process.env, purpose);
  if (!localVars.DATABASE_URL) {
    throw new Error('DATABASE_URL is needed (copy apps/api/.dev.vars.example).');
  }
  return readLocalDatabaseUrl(localVars, purpose);
}
