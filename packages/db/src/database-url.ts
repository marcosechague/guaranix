export function readDatabaseUrl(env: Readonly<Record<string, string | undefined>>): string {
  const url = env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and run `pnpm db:up`.');
  }
  return url;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * For scripts that write demo data: refuses anything but this machine. A
 * `DATABASE_URL` already in the shell wins over `.env`, so a remote one there
 * would otherwise get the demo box.
 */
export function readLocalDatabaseUrl(
  env: Readonly<Record<string, string | undefined>>,
  purpose: string,
): string {
  const url = readDatabaseUrl(env);
  if (env['NODE_ENV'] === 'production' || !LOCAL_HOSTS.has(new URL(url).hostname)) {
    throw new Error(
      `${purpose} only runs against a local database; DATABASE_URL points elsewhere (check your shell, it wins over .env).`,
    );
  }
  return url;
}
