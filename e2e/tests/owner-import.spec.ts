import { expect, test } from '@playwright/test';
import { APPS } from '../support/apps';
import { t } from '../support/i18n';
import { SIGNED_IN } from '../support/sessions';

test.use({ storageState: SIGNED_IN.owner });

test('an owner imports members from a spreadsheet after reviewing every row', async ({ page }) => {
  const stamp = String(Date.now());
  const lastName = `Importado${stamp}`;
  const csv = [
    'Nombre,Apellido,Cédula,Teléfono',
    `Ariel,${lastName},${stamp.slice(-7)},0981${stamp.slice(-6)}`,
  ].join('\n');

  await page.goto(`${APPS.admin}/importar`);
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({ name: 'alumnos.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });

  // Columns are guessed from the headers; nothing is saved until the last step.
  await expect(page.getByRole('combobox', { name: 'Apellido' })).toHaveValue('lastName');
  await page.getByRole('button', { name: t('admin.imports.mapping.review') }).click();

  await expect(page.getByRole('listitem').filter({ hasText: lastName })).toBeVisible();
  await page.getByRole('button', { name: t('admin.imports.preview.commit', { count: 1 }) }).click();
  await expect(page.getByRole('heading', { name: t('admin.imports.done.title') })).toBeVisible();

  await page.goto(`${APPS.admin}/alumnos`);
  await page.getByRole('searchbox').fill(lastName);
  await expect(page.getByText(`Ariel ${lastName}`).first()).toBeVisible();
});
