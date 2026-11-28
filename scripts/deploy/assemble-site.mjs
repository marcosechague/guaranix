#!/usr/bin/env node
/**
 * Puts the three Vite builds where the gateway serves them:
 * member at `/`, admin at `/panel/`, platform at `/plataforma/`.
 * Build admin and platform with APP_BASE_PATH set to the same prefixes first.
 *
 * Usage: node scripts/deploy/assemble-site.mjs
 */
import { cpSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
const SITE = join(ROOT, 'apps/gateway/dist');
const PARTS = [
  ['apps/member/dist', ''],
  ['apps/admin/dist', 'panel'],
  ['apps/platform/dist', 'plataforma'],
];

rmSync(SITE, { recursive: true, force: true });
for (const [source, prefix] of PARTS) {
  const from = join(ROOT, source);
  if (!existsSync(join(from, 'index.html'))) {
    console.error(`Falta el build de ${source}: corré el build de esa app primero.`);
    process.exit(1);
  }
  cpSync(from, join(SITE, prefix), { recursive: true });
}
console.log(`Sitio armado en ${SITE}.`);
