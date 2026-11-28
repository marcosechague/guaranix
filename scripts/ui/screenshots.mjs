#!/usr/bin/env node
/**
 * Screenshots of an app (or any URL) on a phone, a tablet and a desktop, so a
 * reviewer can judge layout and hierarchy instead of guessing from the code.
 *
 *   pnpm ui:screenshots member              starts the member app's dev server
 *   pnpm ui:screenshots all                 member, admin and platform
 *   pnpm ui:screenshots member --path /x    another route
 *   pnpm ui:screenshots --url file:///…/docs/design/Main.html --name ref-main
 *
 * Images go to .claude/screenshots/ (ignored by git). The first time, run
 * `pnpm exec playwright install chromium`.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
const OUTPUT = join(ROOT, '.claude/screenshots');
const APPS = { member: 5173, admin: 5174, platform: 5175 };
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'desktop', width: 1440, height: 900 },
];

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function waitFor(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((done) => setTimeout(done, 300));
  }
  throw new Error(`${url} did not start in ${timeoutMs / 1000}s`);
}

async function startApp(app) {
  const port = APPS[app];
  const url = `http://localhost:${port}`;
  try {
    if ((await fetch(url)).ok) return { url, stop: () => {} };
  } catch {
    // Not running: start it below.
  }
  const server = spawn('pnpm', ['--filter', `@guaranix/${app}`, 'dev'], {
    cwd: ROOT,
    stdio: 'ignore',
    detached: true,
  });
  await waitFor(url);
  return { url, stop: () => process.kill(-server.pid) };
}

async function capture(browser, url, name) {
  const files = [];
  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'networkidle' });
    // Let entrance animations (≤ 250 ms) settle.
    await page.waitForTimeout(400);
    const file = join(OUTPUT, `${name}-${viewport.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    files.push(file);
    await page.close();
  }
  return files;
}

const { chromium } = await import('playwright').catch(() => {
  console.error(
    'Falta Playwright: corré `pnpm install` y `pnpm exec playwright install chromium`.',
  );
  process.exit(1);
});

mkdirSync(OUTPUT, { recursive: true });
const browser = await chromium.launch();
const written = [];
try {
  const url = option('url');
  if (url) {
    written.push(...(await capture(browser, url, option('name') ?? 'page')));
  } else {
    const target = process.argv[2];
    const apps = target === 'all' ? Object.keys(APPS) : [target];
    if (!apps.every((app) => app in APPS)) {
      console.error('Uso: pnpm ui:screenshots <member|admin|platform|all> [--path /ruta]');
      process.exit(1);
    }
    for (const app of apps) {
      const server = await startApp(app);
      try {
        const path = option('path') ?? '/';
        const name = `${app}${path === '/' ? '' : path.replaceAll('/', '-')}`;
        written.push(...(await capture(browser, `${server.url}${path}`, name)));
      } finally {
        server.stop();
      }
    }
  }
} finally {
  await browser.close();
}
console.log(written.map((file) => file.replace(`${ROOT}/`, '')).join('\n'));
