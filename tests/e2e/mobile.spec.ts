import { expect, test } from '@playwright/test';

/** Phone-sized checks: the menu works and no page scrolls sideways. */

const PAGES = ['/', '/consult', '/products', '/products/weleda-skin-food', '/library', '/library/oat', '/colour', '/colour/ilia-balmy-tint', '/ledger', '/privacy', '/system'];

test('the menu opens and navigates on a phone', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Botanical library', exact: true }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole('heading', { name: 'Botanical library' })).toBeVisible();
});

for (const path of PAGES) {
  test(`no sideways scrolling on ${path}`, async ({ page }) => {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
