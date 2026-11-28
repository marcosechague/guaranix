#!/usr/bin/env node
/**
 * Deploys production from your own computer, the same steps as
 * .github/workflows/deploy.yml, for when GitHub Actions cannot run.
 * Reads `.env.production` at the repo root (copy deploy/production.env.example).
 *
 * Usage:
 *   pnpm deploy:setup        once: R2 bucket, queues and Hyperdrive; prints HYPERDRIVE_ID
 *   pnpm deploy:production   migrations, bootstrap, API, apps + gateway, smoke test
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
const ENVIRONMENT = 'production';
const ENV_FILE = join(ROOT, process.env.DEPLOY_ENV_FILE ?? '.env.production');
const WRANGLER = join(ROOT, 'apps/api/node_modules/.bin/wrangler');
const API_CONFIG = join(ROOT, 'apps/api/wrangler.jsonc');

class DeployError extends Error {}

// Throws instead of exiting, so `finally` blocks restore wrangler.jsonc and delete the secrets file.
function fail(message) {
  throw new DeployError(message);
}

function step(title) {
  console.log(`\n▸ ${title}`);
}

function run(command, args, options = {}) {
  try {
    execFileSync(command, args, { cwd: ROOT, stdio: 'inherit', ...options });
  } catch {
    // The command already printed its own error above.
    fail(
      `Falló: ${[command.split('/').pop(), ...args.slice(0, 2)].join(' ')}. Revisá el error de arriba.`,
    );
  }
}

function output(command, args, options = {}) {
  return execFileSync(command, args, { cwd: ROOT, encoding: 'utf8', ...options }).trim();
}

function loadEnvironment() {
  if (!existsSync(ENV_FILE)) {
    fail(`Falta ${ENV_FILE}. Copiá deploy/production.env.example y completalo.`);
  }
  process.loadEnvFile(ENV_FILE);
  for (const name of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'DATABASE_URL']) {
    if (!process.env[name]) fail(`Falta ${name} en ${ENV_FILE}.`);
  }
}

function setup() {
  step('Recursos de Cloudflare (bucket, colas, Hyperdrive)');
  run('node', ['scripts/deploy/setup-resources.mjs', ENVIRONMENT]);
  console.log('\nCopiá el HYPERDRIVE_ID de arriba a .env.production (y al environment de GitHub).');
}

function assertCleanCheckout() {
  const status = output('git', ['status', '--porcelain', '--untracked-files=no']);
  if (status && !process.argv.includes('--allow-dirty')) {
    fail('Hay cambios sin commitear. Publicá un commit limpio (o pasá --allow-dirty).');
  }
  const commit = output('git', ['log', '-1', '--format=%h %s']);
  const branch = output('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  console.log(`Publicando ${branch} @ ${commit}`);
}

async function waitFor(url, expected) {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (response.ok && (await response.text()).includes(expected)) {
        console.log(`OK ${url}`);
        return;
      }
    } catch {
      // A new workers.dev address can take a minute to answer.
    }
    await new Promise((done) => setTimeout(done, 15_000));
  }
  fail(`${url} no respondió como se esperaba.`);
}

function deployApi(origin) {
  const hyperdriveId = process.env.HYPERDRIVE_ID ?? '';
  if (!/^[0-9a-f]{32}$/.test(hyperdriveId)) {
    fail('HYPERDRIVE_ID falta o no es válido: corré `pnpm deploy:setup` y copialo.');
  }
  const secretsFile = join(tmpdir(), `guaranix-api-secrets-${process.pid}.json`);
  const originalConfig = readFileSync(API_CONFIG, 'utf8');
  try {
    run('node', ['scripts/deploy/write-secrets-file.mjs', secretsFile], {
      env: { ...process.env, GITHUB_SECRETS: JSON.stringify(process.env) },
    });
    writeFileSync(
      API_CONFIG,
      originalConfig.replace('"id": "HYPERDRIVE_ID"', `"id": "${hyperdriveId}"`),
    );
    run(
      WRANGLER,
      [
        'deploy',
        '--env',
        ENVIRONMENT,
        '--secrets-file',
        secretsFile,
        '--var',
        `ALLOWED_ORIGINS:${origin}`,
        '--var',
        `PUBLIC_API_URL:${origin}/api`,
        '--var',
        `ADMIN_APP_URL:${origin}/panel`,
        '--var',
        `MEMBER_APP_URL:${origin}`,
      ],
      { cwd: join(ROOT, 'apps/api') },
    );
  } finally {
    // The id stays out of the repo, and the secrets never stay on disk.
    writeFileSync(API_CONFIG, originalConfig);
    rmSync(secretsFile, { force: true });
  }
}

function deployGateway(origin) {
  const env = {
    ...process.env,
    VITE_API_URL: `${origin}/api`,
    VITE_ADMIN_URL: `${origin}/panel/`,
    VITE_PLATFORM_URL: `${origin}/plataforma/`,
  };
  run('pnpm', ['--filter', '@guaranix/member', 'build'], { env });
  run('pnpm', ['--filter', '@guaranix/admin', 'build'], {
    env: { ...env, APP_BASE_PATH: '/panel/' },
  });
  run('pnpm', ['--filter', '@guaranix/platform', 'build'], {
    env: { ...env, APP_BASE_PATH: '/plataforma/' },
  });
  run('node', ['scripts/deploy/assemble-site.mjs']);
  run('node', ['scripts/deploy/write-headers.mjs', 'apps/gateway/dist']);
  run(WRANGLER, ['deploy', '--env', ENVIRONMENT], { cwd: join(ROOT, 'apps/gateway') });
}

async function setTelegramWebhook(origin) {
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_WEBHOOK_SECRET: secret } = process.env;
  if (!token || !secret) return console.log('Telegram sin configurar; se saltea.');
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    body: new URLSearchParams({
      url: `${origin}/api/integrations/telegram/webhook`,
      secret_token: secret,
      allowed_updates: '["message"]',
    }),
  });
  if (!response.ok) fail(`Telegram rechazó el webhook (HTTP ${response.status}).`);
  console.log('Webhook de Telegram registrado.');
}

async function deploy() {
  assertCleanCheckout();
  process.env.WRANGLER_SEND_METRICS = 'false';

  step('Dependencias y configuración');
  run('pnpm', ['install', '--frozen-lockfile']);
  run('pnpm', ['check:deploy']);
  const origin = output('node', ['scripts/deploy/public-url.mjs']);
  console.log(`Dirección pública: ${origin}`);

  step('Migraciones');
  run('pnpm', ['db:migrate']);
  step('Planes y superadmin');
  run('pnpm', ['--filter', '@guaranix/db', 'db:bootstrap']);

  step('API');
  deployApi(origin);
  step('Apps y gateway');
  deployGateway(origin);
  step('Telegram');
  await setTelegramWebhook(origin);

  step('Prueba de humo');
  await waitFor(`${origin}/api/health`, `"environment":"${ENVIRONMENT}"`);
  await waitFor(`${origin}/`, '<div id="root">');
  await waitFor(`${origin}/panel/`, '/panel/assets/');
  await waitFor(`${origin}/panel/alumnos`, '/panel/assets/');
  await waitFor(`${origin}/plataforma/`, '/plataforma/assets/');

  console.log(`\n✓ Publicado.\n  Alumnos:    ${origin}/\n  Panel:      ${origin}/panel/`);
  console.log(`  Plataforma: ${origin}/plataforma/\n  API:        ${origin}/api/health`);
}

try {
  const command = process.argv[2];
  if (command !== 'setup' && command !== 'deploy') {
    fail('Uso: node scripts/deploy/local.mjs <setup|deploy> [--allow-dirty]');
  }
  loadEnvironment();
  if (command === 'setup') setup();
  else await deploy();
} catch (error) {
  if (!(error instanceof DeployError)) throw error;
  console.error(`\n✗ ${error.message}`);
  process.exitCode = 1;
}
