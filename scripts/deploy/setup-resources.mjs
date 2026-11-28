#!/usr/bin/env node
/**
 * Creates the Cloudflare resources of one environment through the REST API:
 * the receipts bucket (R2), the notification queue and its dead-letter queue,
 * and the Hyperdrive config that points at Neon. Anything that already exists is
 * left alone, so it is safe to run again. Prints the Hyperdrive id.
 *
 * Usage: node scripts/deploy/setup-resources.mjs <staging|production>
 * Env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, PROD_DATABASE_URL (Neon, direct, not pooled).
 * Not DATABASE_URL, which belongs to the local development database.
 * Names must match apps/api/wrangler.jsonc.
 */
import { appendFileSync } from 'node:fs';

const environment = process.argv[2];
if (environment !== 'staging' && environment !== 'production') {
  console.error('Uso: node scripts/deploy/setup-resources.mjs <staging|production>');
  process.exit(2);
}
const {
  CLOUDFLARE_API_TOKEN: token,
  CLOUDFLARE_ACCOUNT_ID: accountId,
  PROD_DATABASE_URL: databaseUrl,
} = process.env;
for (const [name, value] of Object.entries({
  CLOUDFLARE_API_TOKEN: token,
  CLOUDFLARE_ACCOUNT_ID: accountId,
  PROD_DATABASE_URL: databaseUrl,
})) {
  if (!value) {
    console.error(`Falta ${name} (ver docs/despliegue.md).`);
    process.exit(1);
  }
}

const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}`;

async function cloudflare(path, init = {}) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok && body.success !== false, body };
}

function fail(what, result) {
  const errors = (result.body.errors ?? []).map((error) => `${error.code}: ${error.message}`);
  throw new Error(`${what} falló (HTTP ${result.status}) ${errors.join('; ')}`);
}

async function ensureBucket(name) {
  const existing = await cloudflare(`/r2/buckets/${name}`);
  if (existing.ok) return console.log(`R2 ${name}: ya existe.`);
  const created = await cloudflare('/r2/buckets', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  if (!created.ok) fail(`Crear el bucket ${name}`, created);
  console.log(`R2 ${name}: creado.`);
}

async function listQueueNames() {
  const names = new Set();
  for (let page = 1; ; page += 1) {
    const result = await cloudflare(`/queues?per_page=100&page=${page}`);
    if (!result.ok) fail('Listar las colas', result);
    const queues = result.body.result ?? [];
    for (const queue of queues) names.add(queue.queue_name);
    if (queues.length < 100) return names;
  }
}

async function ensureQueues(names) {
  const existing = await listQueueNames();
  for (const name of names) {
    if (existing.has(name)) {
      console.log(`Cola ${name}: ya existe.`);
      continue;
    }
    const created = await cloudflare('/queues', {
      method: 'POST',
      body: JSON.stringify({ queue_name: name }),
    });
    if (!created.ok) fail(`Crear la cola ${name}`, created);
    console.log(`Cola ${name}: creada.`);
  }
}

async function ensureHyperdrive(name) {
  const list = await cloudflare('/hyperdrive/configs');
  if (!list.ok) fail('Listar Hyperdrive', list);
  const existing = (list.body.result ?? []).find((config) => config.name === name);
  if (existing) {
    console.log(`Hyperdrive ${name}: ya existe.`);
    return existing.id;
  }
  const url = new URL(databaseUrl);
  if (url.hostname.includes('-pooler.')) {
    throw new Error('PROD_DATABASE_URL es la URL "pooled" de Neon; usá la directa (sin -pooler).');
  }
  const origin = {
    scheme: 'postgresql',
    host: url.hostname,
    port: Number(url.port || 5432),
    database: decodeURIComponent(url.pathname.slice(1)),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
  const created = await cloudflare('/hyperdrive/configs', {
    method: 'POST',
    body: JSON.stringify({ name, origin }),
  });
  if (!created.ok) fail(`Crear Hyperdrive ${name}`, created);
  console.log(`Hyperdrive ${name}: creado.`);
  return created.body.result.id;
}

await ensureBucket(`guaranix-receipts-${environment}`);
await ensureQueues([
  `guaranix-notifications-${environment}`,
  `guaranix-notifications-${environment}-dlq`,
]);
const hyperdriveId = await ensureHyperdrive(`guaranix-${environment}`);

console.log(`HYPERDRIVE_ID (${environment}) = ${hyperdriveId}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    [
      `### Cloudflare listo para ${environment}`,
      '',
      `Guardá esta variable en el environment \`${environment}\` de GitHub:`,
      '',
      `\`HYPERDRIVE_ID\` = \`${hyperdriveId}\``,
      '',
    ].join('\n'),
  );
}
