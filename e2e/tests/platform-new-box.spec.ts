import { expect, test } from '@playwright/test';
import { APPS } from '../support/apps';
import { t } from '../support/i18n';
import { SIGNED_IN } from '../support/sessions';

test.use({ storageState: SIGNED_IN.platformAdmin });

test('a new box owner without Google gets in with a one-time link', async ({ page, browser }) => {
  const boxName = `Box E2E ${Date.now()}`;
  const ownerEmail = `dueno-${Date.now()}@example.com`;
  await page.goto(APPS.platform);
  await page.getByRole('button', { name: t('platform.boxes.new') }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel(t('platform.newBox.name')).fill(boxName);
  await form.getByLabel(t('platform.newBox.ownerName')).fill('Lucía Benítez');
  await form.getByLabel(t('platform.newBox.ownerEmail')).fill(ownerEmail);
  await form.getByRole('button', { name: t('platform.newBox.create') }).click();

  // The box's own page opens with what to send the owner.
  await expect(page.getByRole('heading', { name: boxName })).toBeVisible();
  const sheet = page.getByRole('main');
  await expect(sheet.getByText(t('platform.ownerAccess.pending'))).toBeVisible();
  await expect(sheet.getByText(t('platform.ownerAccess.googleMessage'))).toBeVisible();
  await sheet.getByRole('button', { name: t('platform.ownerAccess.createLink') }).click();
  const message = sheet.getByText(/reset-password\?token=/);
  await expect(message).toBeVisible();
  const link = /(https?:\/\/\S+reset-password\?token=\S+)/.exec(
    (await message.textContent()) ?? '',
  )?.[1];
  expect(link).toBeTruthy();

  // The owner opens it with no session and lands in their own panel.
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await owner.goto(link ?? '');
  await owner.getByLabel(t('auth.reset.password')).fill('una clave larga del dueño');
  await owner.getByRole('button', { name: t('auth.reset.submit') }).click();
  await expect(owner).toHaveURL(new RegExp(`^${APPS.admin}/?$`));
  await expect(owner.getByText(boxName).first()).toBeVisible();
  await ownerContext.close();
});
