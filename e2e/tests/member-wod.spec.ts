import { expect, test } from '@playwright/test';
import { APPS } from '../support/apps';
import { t } from '../support/i18n';
import { SIGNED_IN } from '../support/sessions';
import { goToTab } from '../support/member';

test.use({ storageState: SIGNED_IN.member });

test("a member logs today's result in one screen and sees it on the whiteboard", async ({
  page,
}) => {
  await page.goto(APPS.member);
  await goToTab(page, t('member.wod.title'));

  const minutes = 5 + Math.floor(Math.random() * 40);
  const time = `${minutes}:07`;
  await page.getByLabel(t('member.wod.time')).fill(time);
  // "Guardar" the first time, "Actualizar" when the seed or an earlier run already logged one.
  const save = new RegExp(`^(${t('member.wod.saveResult')}|${t('member.wod.updateResult')})$`);
  await page.getByRole('button', { name: save }).click();
  await expect(page.getByText(t('member.wod.saved'))).toBeVisible();

  const board = page.getByRole('region', { name: t('member.wod.board') });
  await expect(board.getByRole('listitem').filter({ hasText: t('member.wod.you') })).toContainText(
    time,
  );
});
