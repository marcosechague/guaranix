import type { Page } from '@playwright/test';

/** The member app's tab bar (phone) or side rail (tablet and up). */
export function goToTab(page: Page, name: string) {
  return page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name }).click();
}
