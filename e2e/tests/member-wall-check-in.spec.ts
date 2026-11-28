import type { Location } from '@guaranix/shared/api';
import type { WallQrView } from '@guaranix/shared';
import { expect, test } from '@playwright/test';
import { apiAs } from '../support/api';
import { APPS, DEMO } from '../support/apps';
import { t } from '../support/i18n';
import { SIGNED_IN } from '../support/sessions';

test.use({ storageState: SIGNED_IN.member });

// The demo seed places the default location downtown.
const AT_THE_BOX = { latitude: -25.2867, longitude: -57.647, accuracy: 15 };
const AT_HOME = { latitude: -25.31, longitude: -57.6, accuracy: 15 };

async function posterPath() {
  const owner = await apiAs(DEMO.owner);
  try {
    const { locations } = await owner.get<{ locations: Location[] }>('/box/locations');
    const main = locations.find((location) => location.isDefault);
    if (!main) throw new Error('No default location');
    const { poster } = await owner.get<{ poster: WallQrView }>(`/box/locations/${main.id}/wall-qr`);
    return new URL(poster.url).pathname;
  } finally {
    await owner.dispose();
  }
}

test('the wall QR checks in from inside the box and not from home', async ({ page, context }) => {
  const path = await posterPath();
  await context.grantPermissions(['geolocation']);

  await context.setGeolocation(AT_HOME);
  await page.goto(`${APPS.member}${path}`);
  await expect(page.getByText(t('errors.wall_qr_too_far'))).toBeVisible();

  await context.setGeolocation(AT_THE_BOX);
  await page.getByRole('button', { name: t('member.wallCheckIn.retry') }).click();
  // In or not depends on the demo classes of the hour; either way the box answered, not the GPS.
  await expect(page.getByText(t('errors.wall_qr_too_far'))).toBeHidden();
  await expect(
    page
      .getByText(t('member.wallCheckIn.denied'))
      .or(page.getByText(t('member.wallCheckIn.already')))
      .or(page.getByText(/^¡Listo, /)),
  ).toBeVisible();
});
