import { expect, test } from '@playwright/test';
import { APPS, DEMO } from '../support/apps';
import { t } from '../support/i18n';
import { SIGNED_IN } from '../support/sessions';

test.use({ storageState: SIGNED_IN.platformAdmin });

test('support enters a box read-only, with a banner, and cannot change anything', async ({
  page,
}) => {
  await page.goto(APPS.platform);
  // Desktop shows the boxes as a table.
  const box = page.getByRole('row').filter({ hasText: DEMO.boxName });
  await box.getByRole('button', { name: 'Entrar como' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('solo lectura');
  await dialog.getByLabel('Motivo').fill('Prueba automática de soporte');
  await dialog
    .getByRole('button', { name: t('platform.statusChange.impersonate.confirm') })
    .click();

  // The box panel, not the sign-up wizard, with the read-only banner on top.
  await expect(page).toHaveURL(new RegExp(`^${APPS.admin}`));
  const banner = page.getByRole('status').filter({ hasText: DEMO.boxName });
  await expect(banner).toContainText('solo lectura');
  await expect(
    page.getByRole('heading', { name: t('admin.home.greeting', { name: 'GuaraniX' }) }),
  ).toBeVisible();

  // The server refuses writes no matter what the screen offers.
  const session = await (await page.request.get(`${APPS.api}/auth/session`)).json();
  const write = await page.request.post(`${APPS.api}/box/programs`, {
    data: { name: 'No debería existir' },
    headers: { origin: APPS.admin, 'x-csrf-token': session.csrfToken },
  });
  expect(write.status()).toBe(403);
  expect(await write.json()).toEqual({ error: 'impersonation_read_only' });

  await banner.getByRole('button', { name: t('platform.impersonation.leave') }).click();
  await expect(banner).toBeHidden();
});
