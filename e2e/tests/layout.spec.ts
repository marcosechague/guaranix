import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { APPS, DEMO } from '../support/apps';
import { MIN_WIDTH_SHARE, measureLayout } from '../support/layout';
import { SIGNED_IN } from '../support/sessions';

// Stands for the seeded demo box's id, which changes on every seed.
const DEMO_BOX = ':demoBox';

// Reads it with the page's own signed-in session: a fresh login per test trips the rate limit.
async function demoBoxId(page: Page) {
  const response = await page.request.get(`${APPS.api}/platform/boxes`, {
    headers: { origin: APPS.platform },
  });
  const { boxes } = (await response.json()) as { boxes: { id: string; name: string }[] };
  const demo = boxes.find((box) => box.name === DEMO.boxName);
  if (!demo) throw new Error(`The seed has no box named ${DEMO.boxName}`);
  return demo.id;
}

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
    paths: [
      '/',
      '/planes',
      '/ia',
      `/box/${DEMO_BOX}`,
      `/box/${DEMO_BOX}?seccion=funciones`,
      `/box/${DEMO_BOX}?seccion=actividad`,
    ],
  },
} as const;

const SCREENSHOTS = fileURLToPath(new URL('../../.claude/screenshots/layout', import.meta.url));
mkdirSync(SCREENSHOTS, { recursive: true });

for (const [app, { session, paths }] of Object.entries(SCREENS)) {
  test.describe(app, () => {
    test.use({ storageState: session });

    for (const path of paths) {
      test(`${path} fits the screen`, async ({ page }, testInfo) => {
        const route = path.includes(DEMO_BOX)
          ? path.replace(DEMO_BOX, await demoBoxId(page))
          : path;
        await page.goto(`${APPS[app as keyof typeof SCREENS]}${route}`);
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        await page.waitForLoadState('networkidle');
        // Let entrance animations (≤ 250 ms) settle.
        await page.waitForTimeout(400);

        const name = `${app}${path === '/' ? '-inicio' : path.replace(/[/?=:]+/g, '-')}`;
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
