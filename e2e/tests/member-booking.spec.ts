import type { ClassListItem } from '@guaranix/shared/api';
import { expect, test } from '@playwright/test';
import { apiAs, type StaffApi } from '../support/api';
import { APPS, DEMO } from '../support/apps';
import { boxDate, boxTime } from '../support/dates';
import { t } from '../support/i18n';
import { SIGNED_IN } from '../support/sessions';
import { goToTab } from '../support/member';

test.use({ storageState: SIGNED_IN.member });

// Two days ahead: never "today", whose classes may already be over when CI runs at night.
const DAY_INDEX = 2;
const date = boxDate(DAY_INDEX);

let owner: StaffApi;
let member: StaffApi;
let filled: { id: string; capacity: number } | null = null;

test.beforeAll(async () => {
  owner = await apiAs(DEMO.owner);
  member = await apiAs(DEMO.member, APPS.member);
  // The seed opens bookings 24 h ahead; open them a week ahead so the day is bookable.
  const { policy } = await owner.get<{ policy: Record<string, unknown> }>('/box/settings/booking');
  await owner.patch('/box/settings/booking', { ...policy, bookingOpensHoursBefore: 24 * 7 });
});

test.afterAll(async () => {
  if (filled) await owner.patch(`/box/classes/${filled.id}`, { capacity: filled.capacity });
  await Promise.all([owner.dispose(), member.dispose()]);
});

// Asked as the member so `ownBooking` is theirs: the seed books them into its next
// class, which is two days ahead when it runs on a Saturday.
async function classesOfTheDay() {
  const { classes } = await member.get<{ classes: ClassListItem[] }>(
    `/box/classes?from=${date}&to=${date}`,
  );
  return classes.filter((item) => item.status === 'scheduled');
}

test('a member books a class in two taps and cancels it', async ({ page }) => {
  await page.goto(APPS.member);
  await goToTab(page, t('member.book.title'));
  await page
    .getByRole('radiogroup', { name: t('member.book.days') })
    .getByRole('radio')
    .nth(DAY_INDEX)
    .click();

  const row = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('button', { name: t('member.book.book'), exact: true }) })
    .first();
  const time = (await row.textContent())?.match(/\d{2}:\d{2}/)?.[0] ?? '';
  await row.getByRole('button', { name: t('member.book.book'), exact: true }).click();

  const booked = page.getByRole('listitem').filter({ hasText: time });
  await expect(booked.getByRole('button', { name: t('member.book.booked') })).toBeVisible();

  await booked.getByRole('button', { name: t('member.book.booked') }).click();
  await page.getByRole('button', { name: t('member.book.confirmCancel') }).click();
  await expect(
    booked.getByRole('button', { name: t('member.book.book'), exact: true }),
  ).toBeVisible();
});

test('a full class offers the waitlist with your position, and you can leave it', async ({
  page,
}) => {
  const target = (await classesOfTheDay()).find(
    (item) => item.takenSpots > 0 && item.waitlistCount === 0 && item.ownBooking === null,
  );
  test.skip(!target, 'No class with bookings by others two days ahead in the seed');
  if (!target) return;
  filled = { id: target.id, capacity: target.capacity };
  await owner.patch(`/box/classes/${target.id}`, { capacity: target.takenSpots });

  await page.goto(APPS.member);
  await goToTab(page, t('member.book.title'));
  await page
    .getByRole('radiogroup', { name: t('member.book.days') })
    .getByRole('radio')
    .nth(DAY_INDEX)
    .click();
  const row = page
    .getByRole('listitem')
    .filter({ hasText: boxTime(target.startsAt) })
    .filter({ hasText: target.programName });
  await row.getByRole('button', { name: t('member.book.joinWaitlist') }).click();

  const waiting = row.getByRole('button', { name: t('member.book.waitlisted', { position: 1 }) });
  await expect(waiting).toBeVisible();
  await waiting.click();
  await expect(
    page.getByRole('heading', { name: t('member.book.leaveWaitlistTitle') }),
  ).toBeVisible();
  await page.getByRole('button', { name: t('member.book.confirmCancel') }).click();
  await expect(row.getByRole('button', { name: t('member.book.joinWaitlist') })).toBeVisible();
});
