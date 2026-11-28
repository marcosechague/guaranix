import { expect, test } from '@playwright/test';
import { APPS, DEMO } from '../support/apps';
import { TINY_PNG } from '../support/files';
import { t } from '../support/i18n';
import { SIGNED_IN } from '../support/sessions';

test('a member reports a transfer with its receipt and the front desk confirms it', async ({
  browser,
}) => {
  const reference = `E2E-${Date.now()}`;

  const memberContext = await browser.newContext({
    storageState: SIGNED_IN.member,
    viewport: { width: 390, height: 844 },
  });
  const member = await memberContext.newPage();
  await member.goto(`${APPS.member}/cuota`);
  await member
    .getByRole('button', { name: t('member.fees.report') })
    .first()
    .click();
  const sheet = member.getByRole('dialog', { name: t('member.fees.sheetTitle') });
  await sheet.getByLabel(t('member.fees.amount')).fill('150000');
  await sheet.locator('input[type=file]').setInputFiles({
    name: 'comprobante.png',
    mimeType: 'image/png',
    buffer: TINY_PNG,
  });
  await sheet.getByLabel(t('member.fees.reference')).fill(reference);
  await sheet.getByRole('button', { name: t('member.fees.send') }).click();
  await expect(member.getByText(t('member.fees.sent'))).toBeVisible();
  await memberContext.close();

  const deskContext = await browser.newContext({ storageState: SIGNED_IN.reception });
  const desk = await deskContext.newPage();
  await desk.goto(`${APPS.admin}/cobros`);
  const toReview = desk
    .getByRole('listitem')
    .filter({ hasText: t('admin.payments.referenceShort', { reference }) });
  await expect(toReview).toContainText(DEMO.memberName);
  await toReview
    .getByRole('button', { name: t('admin.payments.confirmLabel', { name: DEMO.memberName }) })
    .click();
  await expect(desk.getByText(t('admin.payments.confirmed'))).toBeVisible();
  await expect(toReview).toHaveCount(0);
  await deskContext.close();
});
