import { t } from './i18n';
import { expect, type Page } from '@playwright/test';
import { DEMO } from './apps';

/** Logs in through the real form, as a person would. */
export async function logIn(page: Page, appUrl: string, email: string, password = DEMO.password) {
  await page.goto(appUrl);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: t('auth.login.submit') }).click();
  await expect(page.getByRole('heading', { name: t('auth.login.title') })).toBeHidden();
}
