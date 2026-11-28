#!/usr/bin/env node
/**
 * Checks the deploy wiring that a typo would break silently: the gateway's
 * service binding names the API Worker, the API has no public address of its
 * own, the URL vars the deploy fills with `--var` are declared, and the prefixes
 * the gateway serves match the apps' build paths.
 *
 * Usage: node scripts/deploy/check-config.mjs
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJsonc } from './jsonc.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
const ENVIRONMENT = 'production';
const URL_VARS = ['ALLOWED_ORIGINS', 'PUBLIC_API_URL', 'ADMIN_APP_URL', 'MEMBER_APP_URL'];
const problems = [];

function expectEqual(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    problems.push(
      `${label}: es ${JSON.stringify(actual)}, se esperaba ${JSON.stringify(expected)}`,
    );
  }
}

const api = readJsonc(join(ROOT, 'apps/api/wrangler.jsonc')).env?.[ENVIRONMENT];
const gateway = readJsonc(join(ROOT, 'apps/gateway/wrangler.jsonc')).env?.[ENVIRONMENT];
if (!api) problems.push(`apps/api/wrangler.jsonc no tiene env.${ENVIRONMENT}`);
if (!gateway) problems.push(`apps/gateway/wrangler.jsonc no tiene env.${ENVIRONMENT}`);

if (api && gateway) {
  expectEqual('API workers_dev', api.workers_dev, false);
  expectEqual('API routes', api.routes ?? [], []);
  expectEqual('API APP_ENV', api.vars?.APP_ENV, ENVIRONMENT);
  for (const name of URL_VARS) {
    if (!(name in (api.vars ?? {}))) problems.push(`API vars: falta ${name} (lo llena el deploy)`);
  }
  const binding = (gateway.services ?? []).find((service) => service.binding === 'API');
  expectEqual('gateway → API (service binding)', binding?.service, api.name);
  expectEqual('gateway run_worker_first', gateway.assets?.run_worker_first, ['/api/*']);
  expectEqual('gateway not_found_handling', gateway.assets?.not_found_handling, 'none');
}

// The gateway's prefixes must match the paths the deploy builds admin and platform with.
const routing = readFileSync(join(ROOT, 'apps/gateway/src/routing.ts'), 'utf8');
const assemble = readFileSync(join(ROOT, 'scripts/deploy/assemble-site.mjs'), 'utf8');
for (const prefix of ['panel', 'plataforma']) {
  if (!routing.includes(`'/${prefix}'`))
    problems.push(`apps/gateway/src/routing.ts no sirve /${prefix}`);
  if (!assemble.includes(`'${prefix}'`)) problems.push(`assemble-site.mjs no copia /${prefix}`);
}

if (problems.length > 0) {
  console.error(
    'La configuración de despliegue no coincide:\n' +
      problems.map((problem) => `  - ${problem}`).join('\n'),
  );
  process.exit(1);
}
console.log('Configuración de despliegue consistente.');
