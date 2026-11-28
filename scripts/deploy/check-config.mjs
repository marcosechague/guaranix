#!/usr/bin/env node
/**
 * Checks that the hostnames in deploy/environments.json (used to build the apps)
 * match the wrangler configs (routes, ALLOWED_ORIGINS, PUBLIC_API_URL). A
 * mismatch would deploy an app that calls the wrong API or a blocked origin.
 *
 * Usage: node scripts/deploy/check-config.mjs
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJsonc } from './jsonc.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
const ENVIRONMENTS = ['staging', 'production'];
const APPS = ['member', 'admin', 'platform', 'api'];

const urls = JSON.parse(readFileSync(join(ROOT, 'deploy/environments.json'), 'utf8'));
const problems = [];

function expectEqual(label, actual, expected) {
  if (actual !== expected)
    problems.push(
      `${label}: es ${JSON.stringify(actual)}, se esperaba ${JSON.stringify(expected)}`,
    );
}

for (const environment of ENVIRONMENTS) {
  const appUrls = urls[environment];
  if (!appUrls) {
    problems.push(`deploy/environments.json no tiene "${environment}"`);
    continue;
  }
  for (const app of APPS) {
    const config = readJsonc(join(ROOT, 'apps', app, 'wrangler.jsonc'));
    const section = config.env?.[environment];
    const where = `apps/${app}/wrangler.jsonc env.${environment}`;
    if (!section) {
      problems.push(`${where} no existe`);
      continue;
    }
    const routes = section.routes ?? [];
    expectEqual(
      `${where} routes`,
      routes.map((route) => route.pattern).join(','),
      new URL(appUrls[app]).host,
    );
    if (!routes.every((route) => route.custom_domain === true))
      problems.push(`${where}: las rutas tienen que ser custom_domain`);
    expectEqual(`${where} workers_dev`, section.workers_dev, false);
    if (app === 'api') {
      const vars = section.vars ?? {};
      expectEqual(`${where} APP_ENV`, vars.APP_ENV, environment);
      expectEqual(`${where} PUBLIC_API_URL`, vars.PUBLIC_API_URL, appUrls.api);
      expectEqual(`${where} ADMIN_APP_URL`, vars.ADMIN_APP_URL, appUrls.admin);
      expectEqual(`${where} MEMBER_APP_URL`, vars.MEMBER_APP_URL, appUrls.member);
      expectEqual(
        `${where} ALLOWED_ORIGINS`,
        vars.ALLOWED_ORIGINS,
        [appUrls.member, appUrls.admin, appUrls.platform].join(','),
      );
    }
  }
}

if (problems.length > 0) {
  console.error(
    'La configuración de despliegue no coincide:\n' +
      problems.map((problem) => `  - ${problem}`).join('\n'),
  );
  process.exit(1);
}
console.log('Configuración de despliegue consistente (staging y production).');
