import { expect, test } from '@playwright/test';
import { APPS } from '../support/apps';
import { t } from '../support/i18n';

test('a new owner signs up and creates their box in five steps', async ({ page }) => {
  const stamp = Date.now();
  const boxName = `Box E2E ${stamp}`;
  await page.goto(APPS.admin);
  await page.getByRole('button', { name: t('auth.login.signupLink') }).click();
  await page.getByLabel(t('auth.signup.fullName')).fill('Rosa Benítez');
  await page.getByLabel('Email').fill(`owner-${stamp}@e2e.guaranix.test`);
  await page.getByLabel('Contraseña').fill('una frase larga y segura');
  await page.getByRole('button', { name: t('auth.signup.submit') }).click();

  // 1. Business type: the Paraguayan CrossFit template.
  await expect(page.getByText(t('onboarding.stepCount', { current: 1, total: 5 }))).toBeVisible();
  await page.getByRole('radio', { name: /Box de CrossFit/ }).click();
  // 2. Details.
  await page.getByLabel(t('onboarding.details.name')).fill(boxName);
  await page.getByRole('button', { name: t('onboarding.next') }).click();
  // 3. Schedule and 4. plans come from the template.
  await expect(page.getByText(t('onboarding.stepCount', { current: 3, total: 5 }))).toBeVisible();
  await page.getByRole('button', { name: t('onboarding.next') }).click();
  await expect(page.getByText(t('onboarding.stepCount', { current: 4, total: 5 }))).toBeVisible();
  await page.getByRole('button', { name: t('onboarding.next') }).click();
  // 5. Review.
  await expect(page.getByRole('heading', { name: boxName })).toBeVisible();
  await expect(page.getByText(t('onboarding.review.allGood'))).toBeVisible();
  await page.getByRole('button', { name: t('onboarding.review.create') }).click();

  await expect(
    page.getByRole('heading', { name: t('admin.home.greeting', { name: 'Rosa' }) }),
  ).toBeVisible();
  await expect(page.getByText(boxName).first()).toBeVisible();
});
