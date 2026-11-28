import { t } from '../support/i18n';
import { expect, test } from '@playwright/test';
import { APPS, DEMO } from '../support/apps';
import { logIn } from '../support/login';

const loginHeading = t('auth.login.title');

test.describe('login (member app)', () => {
  test('a wrong password says so and keeps you out', async ({ page }) => {
    await page.goto(APPS.member);
    await page.getByLabel('Email').fill(DEMO.member);
    await page.getByLabel('Contraseña').fill('not the password');
    await page.getByRole('button', { name: t('auth.login.submit') }).click();
    await expect(page.getByText(t('auth.errors.invalid_credentials'))).toBeVisible();
    await expect(page.getByRole('heading', { name: loginHeading })).toBeVisible();
  });

  test('a member logs in, sees their box and logs out', async ({ page }) => {
    await logIn(page, APPS.member, DEMO.member);
    await expect(page.getByRole('navigation', { name: 'Secciones' })).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Secciones' })
      .getByRole('link', { name: 'Perfil' })
      .click();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page.getByRole('heading', { name: loginHeading })).toBeVisible();
    // The session is really gone, not just hidden.
    await page.reload();
    await expect(page.getByRole('heading', { name: loginHeading })).toBeVisible();
  });
});
