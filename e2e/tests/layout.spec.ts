import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { APPS } from '../support/apps';
import { MIN_WIDTH_SHARE, measureLayout } from '../support/layout';
import { SIGNED_IN } from '../support/sessions';

/**
 * Every main screen of the three apps, at phone, tablet and desktop size (one
 * Playwright project each). Fails when a screen scrolls sideways, when something
 * sticks out of the window, or when a tablet or desktop is left half empty. The
 * captures land in .claude/screenshots/layout/ for the ux-reviewer.
 * Add a screen here when you add a route.
 */
const SCREENS = {
  member: {
    session: SIGNED_IN.member,
    paths: ['/', '/reservar', '/wod', '/progreso', '/cuota', '/perfil'],
  },
  admin: {
    session: SIGNED_IN.owner,
    paths: [
      '/',
      '/alumnos',
      '/clases',
      '/wod',
      '/cobros',
      '/planes',
      '/ajustes',
      '/importar',
      '/brodi',
      '/cuenta',
    ],
  },
  platform: {
    session: SIGNED_IN.platformAdmin,
    paths: ['/', '/planes', '/ia'],
  },
} as const;

const SCREENSHOTS = fileURLToPath(new URL('../../.claude/screenshots/layout', import.meta.url));
mkdirSync(SCREENSHOTS, { recursive: true });

for (const [app, { session, paths }] of Object.entries(SCREENS)) {
  test.describe(app, () => {
    test.use({ storageState: session });

    for (const path of paths) {
      test(`${path} fits the screen`, async ({ page }, testInfo) => {
        await page.goto(`${APPS[app as keyof typeof SCREENS]}${path}`);
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        await page.waitForLoadState('networkidle');
        // Let entrance animations (≤ 250 ms) settle.
        await page.waitForTimeout(400);

        const name = `${app}${path === '/' ? '-inicio' : path.replaceAll('/', '-')}`;
        await page.screenshot({
          path: `${SCREENSHOTS}/${name}-${testInfo.project.name.replace('layout-', '')}.png`,
          fullPage: true,
        });

        const layout = await measureLayout(page);
        expect(layout.horizontalOverflow, 'la pantalla tiene scroll horizontal').toBe(0);
        expect(layout.offscreen, 'elementos que se salen por la derecha').toEqual([]);
        if (testInfo.project.name !== 'layout-phone') {
          expect(
            layout.widthShare,
            `el contenido usa menos del ${MIN_WIDTH_SHARE * 100}% del ancho disponible`,
          ).toBeGreaterThanOrEqual(MIN_WIDTH_SHARE);
        }
      });
    }
  });
}
