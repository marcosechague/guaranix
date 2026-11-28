/** Shared by the demo scripts: local settings and the guard that keeps them off shared databases. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

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

export const localVars: Record<string, string | undefined> = { ...devVars(), ...process.env };

/** The local database URL; throws unless it points at this machine. */
export function localDatabaseUrl(purpose: string): string {
  const databaseUrl = localVars.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is needed (copy apps/api/.dev.vars.example).');
  if (process.env.NODE_ENV === 'production' || !LOCAL_HOSTS.has(new URL(databaseUrl).hostname)) {
    throw new Error(`${purpose} only runs against a local development database.`);
  }
  return databaseUrl;
}
