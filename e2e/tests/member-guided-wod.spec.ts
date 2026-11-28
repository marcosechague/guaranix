import { expect, test } from '@playwright/test';
import { APPS } from '../support/apps';
import { t } from '../support/i18n';
import { goToTab } from '../support/member';
import { SIGNED_IN } from '../support/sessions';

test.use({ storageState: SIGNED_IN.member });

test('a member does the WOD in guided mode and only confirms the result', async ({ page }) => {
  // A fake clock, so the countdown and the workout take no real time.
  await page.clock.install();
  await page.goto(APPS.member);
  await goToTab(page, t('member.wod.title'));
  await page
    .getByRole('link', { name: t('member.guided.open') })
    .first()
    .click();

  // Before: 75% of the demo member's 40 kg Thruster 1RM, with + and −.
  await expect(page.getByTestId('guided-load')).toHaveText('30 kg');
  await page.getByRole('button', { name: t('member.guided.moreLoad') }).click();
  await expect(page.getByTestId('guided-load')).toHaveText('32,5 kg');
  await page.getByRole('button', { name: t('member.guided.start') }).click();

  // During: a tap anywhere marks the movement done and shows the next one.
  await page.clock.fastForward('00:10');
  const tap = page.getByTestId('guided-tap');
  await expect(tap).toContainText('Thrusters');
  await page.clock.fastForward('01:30');
  await tap.click();
  await expect(tap).toContainText('Pull-ups');
  await page.getByRole('button', { name: t('member.guided.undo') }).click();
  await expect(tap).toContainText('Thrusters');
  for (let step = 0; step < 7; step += 1) {
    await page.clock.fastForward('00:40');
    await tap.click();
  }

  // After: time and load already filled in; one tap to save.
  const time = page.getByLabel(t('member.wod.time'));
  await expect(time).not.toHaveValue('');
  await expect(page.getByLabel(t('member.wod.usedLoad'))).toHaveValue('32,5');
  const finalTime = await time.inputValue();
  await page.getByRole('button', { name: t('member.wod.saveResult') }).click();
  await expect(page.getByText(t('member.wod.saved'))).toBeVisible();

  await page.getByRole('button', { name: t('member.timer.backToWod') }).click();
  const board = page.getByRole('region', { name: t('member.wod.board') });
  await expect(board.getByRole('listitem').filter({ hasText: t('member.wod.you') })).toContainText(
    finalTime,
  );
});
