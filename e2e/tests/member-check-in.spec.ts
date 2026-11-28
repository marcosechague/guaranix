import type { CheckInPassView } from '@guaranix/shared';
import { devices, expect, test } from '@playwright/test';
import { APPS, DEMO } from '../support/apps';
import { fakeCamera } from '../support/fake-camera';
import { t } from '../support/i18n';
import { SIGNED_IN } from '../support/sessions';

test.use({ storageState: SIGNED_IN.member });

test('the member shows their QR and the entrance reads it', async ({ page, browser }) => {
  await page.goto(APPS.member);
  const passResponse = page.waitForResponse((response) =>
    response.url().endsWith('/box/me/check-in-pass'),
  );
  await page
    .getByRole('link', { name: t('member.checkIn.open') })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: t('member.checkIn.title') })).toBeVisible();
  await expect(page.getByRole('img', { name: t('member.checkIn.qrLabel') })).toBeVisible();
  const { pass } = (await (await passResponse).json()) as { pass: CheckInPassView };

  const entrance = await browser.newContext({
    ...devices['Desktop Chrome'],
    storageState: SIGNED_IN.reception,
    locale: 'es-PY',
    timezoneId: 'America/Asuncion',
  });
  const desk = await entrance.newPage();
  await fakeCamera(desk);
  await desk.goto(`${APPS.admin}/entrada`);
  await expect(desk.getByText(t('admin.checkIn.waitingTitle'))).toBeVisible();

  await desk.evaluate(`window.__qr = ${JSON.stringify(pass.pass)}`);
  // Allowed or not depends on the demo data of the day; either way the screen names the member.
  const firstName = DEMO.memberName.split(' ')[0] ?? '';
  await expect(desk.getByRole('paragraph').filter({ hasText: firstName }).first()).toBeVisible();
  await expect(desk.getByRole('listitem').filter({ hasText: DEMO.memberName })).toBeVisible();
  await entrance.close();
});
