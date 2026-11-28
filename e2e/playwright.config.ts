import { defineConfig, devices } from '@playwright/test';
import { APPS } from './support/apps';
import { LAYOUT_VIEWPORTS } from './support/layout';

const CI = Boolean(process.env.CI);

/**
 * End-to-end tests of the critical flows against the real stack: Postgres with
 * the demo seed, the Worker under `wrangler dev` and the three Vite apps.
 * Locally: `pnpm db:up && pnpm db:migrate && pnpm db:seed`, then `pnpm e2e`
 * (it reuses `pnpm dev` if it is already running).
 */
export default defineConfig({
  testDir: './tests',
  globalSetup: './support/global-setup.ts',
  // The flows share one seeded box, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    locale: 'es-PY',
    timezoneId: 'America/Asuncion',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] }, testMatch: /member|auth/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /member|auth|layout/ },
    // Every main screen at the three sizes (see tests/layout.spec.ts).
    ...Object.entries(LAYOUT_VIEWPORTS).map(([size, viewport]) => ({
      name: `layout-${size}`,
      use: { ...devices['Desktop Chrome'], viewport },
      testMatch: /layout/,
    })),
  ],
  webServer: {
    command: 'pnpm --dir .. dev',
    url: `${APPS.api}/health`,
    reuseExistingServer: !CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
