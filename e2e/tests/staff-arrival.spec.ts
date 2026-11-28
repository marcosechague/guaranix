import type { CheckInPassView, CheckInPolicy } from '@guaranix/shared';
import { devices, expect, test } from '@playwright/test';
import { apiAs } from '../support/api';
import { APPS, DEMO } from '../support/apps';
import { fakeCamera } from '../support/fake-camera';
import { t } from '../support/i18n';
import { SIGNED_IN } from '../support/sessions';

test.use({ storageState: SIGNED_IN.owner });

// Turned on here, so the test does not depend on a database seeded before this mode existed.
test.beforeAll(async () => {
  const owner = await apiAs(DEMO.owner);
  try {
    const { policy } = await owner.get<{ policy: CheckInPolicy }>('/box/settings/check-in');
    await owner.patch('/box/settings/check-in', {
      ...policy,
      checkInDeskEnabled: true,
      checkInStaffEnabled: true,
    });
  } finally {
    await owner.dispose();
  }
});

test('staff show their own QR at the entrance and the owner sees who arrived', async ({
  page,
  browser,
}) => {
  await page.goto(`${APPS.admin}/mi-qr`);
  const passResponse = page.waitForResponse((response) =>
    response.url().includes('/box/check-ins/staff-pass'),
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: t('admin.staffPass.title') })).toBeVisible();
  await expect(page.getByRole('img', { name: t('admin.staffPass.qrLabel') })).toBeVisible();
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
  await expect(
    desk.getByRole('listitem').filter({ hasText: t('admin.checkIn.recentStaff') }),
  ).toBeVisible();
  await entrance.close();

  await page.goto(APPS.admin);
  await expect(page.getByRole('heading', { name: t('admin.home.staffArrivals') })).toBeVisible();
  await expect(page.getByText(t('admin.home.noStaffArrivals'))).toHaveCount(0);
});
