export function readDatabaseUrl(env: Readonly<Record<string, string | undefined>>): string {
  const url = env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and run `pnpm db:up`.');
  }
  return url;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** Present only where the deploy runs; a shell that has them is not a dev machine. */
const PRODUCTION_MARKERS = ['PROD_DATABASE_URL'] as const;

/**
 * Local-only scripts refuse to run next to production settings: one stray
 * variable there (a database URL, a secret) would mix demo data with real data.
 */
export function assertNoProductionEnv(
  env: Readonly<Record<string, string | undefined>>,
  purpose: string,
): void {
  const found: string[] = PRODUCTION_MARKERS.filter((name) => env[name]);
  if (env['NODE_ENV'] === 'production') found.push('NODE_ENV=production');
  if (found.length > 0) {
    throw new Error(
      `${purpose} only runs on a development machine, but this shell has production settings (${found.join(', ')}). Open a shell without them, or unset them for this command.`,
    );
  }
}

export function isLocalDatabaseUrl(url: string): boolean {
  return LOCAL_HOSTS.has(new URL(url).hostname);
}

/**
 * For scripts that write demo data: refuses anything but this machine. A
 * `DATABASE_URL` already in the shell wins over `.env`, so a remote one there
 * would otherwise get the demo box.
 */
export function readLocalDatabaseUrl(
  env: Readonly<Record<string, string | undefined>>,
  purpose: string,
): string {
  assertNoProductionEnv(env, purpose);
  const url = readDatabaseUrl(env);
  if (!isLocalDatabaseUrl(url)) {
    throw new Error(
      `${purpose} only runs against a local database; DATABASE_URL points elsewhere (check your shell, it wins over .env).`,
    );
  }
  return url;
}
