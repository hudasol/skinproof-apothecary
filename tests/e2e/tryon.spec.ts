import { expect, test } from '@playwright/test';
import { agreeToAnalysis, syntheticPortrait } from './helpers';

/** Lip colour try-on, fixture mode, on its own and as part of a consultation with limits. */

test('a shopper tries a shade on after agreeing to try-on', async ({ page }) => {
  await page.goto('/colour');
  await expect(page.getByRole('heading', { name: 'Botanical lip colour' })).toBeVisible();
  await page.getByRole('link', { name: /Lullaby/ }).click();
  await expect(page).toHaveURL(/\/colour\/ilia-balmy-tint\?shade=lullaby/);
  await expect(page.getByText(/Rendering colour #[0-9A-F]{6}, measured/)).toBeVisible();

  await page.getByLabel(/Use my photo for lip colour try-on/).check();
  await page.getByRole('button', { name: 'Agree and continue' }).click();
  await page.getByLabel('Your photo').setInputFiles({ name: 'p.jpg', mimeType: 'image/jpeg', buffer: await syntheticPortrait() });
  await page.getByRole('button', { name: 'Use this photo' }).click();
  await expect(page).toHaveURL(/\/colour\/ilia-balmy-tint\?shade=lullaby/);

  await page.getByRole('button', { name: 'Try Lullaby on my photo' }).click();
  await expect(page.getByRole('img', { name: 'Lullaby, fixture placeholder' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/this tint is a placeholder drawn by SkinProof/)).toBeVisible();
  const divider = page.getByRole('slider', { name: /Move the divider/ });
  await divider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(divider).toHaveValue('51');

  // Returning to the same shade shows the finished render without starting another.
  await page.reload();
  await expect(page.getByRole('img', { name: 'Lullaby, fixture placeholder' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try Lullaby on my photo' })).toHaveCount(0);
});

test('shades without a brand swatch, or that break a limit, cannot be tried on', async ({ page }) => {
  await page.goto('/colour/burts-bees-tinted-lip-balm?shade=rose');
  await expect(page.getByText(/publishes no swatch image to measure a colour from/)).toBeVisible();

  await agreeToAnalysis(page, true);
  await page.goto('/consult/goals');
  await page.getByLabel(/Support hydration/).check();
  await page.getByLabel(/No added fragrance/).check();
  await page.getByRole('button', { name: 'Show my shortlist' }).click();
  await expect(page).toHaveURL(/\/shortlist$/);

  await page.goto('/colour/hurraw-tinted-lip-balm?shade=raspberry');
  await expect(page.getByText('Excluded by your limits')).toBeVisible();
  await expect(page.getByText(/Flavor\/Aroma: Contains added fragrance/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Try Raspberry/ })).toHaveCount(0);
});
