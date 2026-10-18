import { expect, test } from '@playwright/test';
import { agreeToAnalysis, uploadAndAnalyse } from './helpers';

/** The primary journey, fixture mode: consent → photo → analysis → goals → shortlist → dossier → compare → delete. */

test('a shopper goes from consent to a reasoned shortlist and can delete everything', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Botanical skincare, with the evidence on the label.');
  await expect(page.getByText('Demonstration data.')).toBeVisible();
  await page.getByRole('link', { name: 'Start a consultation' }).first().click();

  await agreeToAnalysis(page);
  await uploadAndAnalyse(page);

  await expect(page.getByRole('heading', { name: 'What the analysis saw' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Fixture, not YouCam', { exact: true })).toBeVisible();
  await expect(page.getByText('Suggested focus')).toHaveCount(3);
  await page.getByRole('link', { name: 'Choose your goals' }).click();

  // Suggested goals arrive ticked; add a hard limit.
  await expect(page.getByText(/Suggested by your analysis/)).toHaveCount(3);
  await page.getByLabel(/No added fragrance/).check();
  await page.getByRole('button', { name: 'Show my shortlist' }).click();

  await expect(page).toHaveURL(/\/shortlist$/);
  await expect(page.getByRole('heading', { name: 'Your shortlist' })).toBeVisible();
  await expect(page.getByText(/rules ledger-1\.0\.0 and catalogue cat-/)).toBeVisible();

  // The Ledger's exclusions are visible and explained.
  await page.getByText(/Excluded by your choices \(/).click();
  await expect(page.getByText(/Fragrance \(Parfum\): Contains added fragrance/).first()).toBeVisible();

  // Open the first entry's dossier.
  const first = page.locator('ol li').filter({ has: page.getByRole('heading', { level: 3 }) }).first();
  const name = await first.getByRole('heading', { level: 3 }).innerText();
  await first.getByRole('heading', { level: 3 }).getByRole('link').click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(name.split(' ').slice(-1)[0]!);
  await expect(page.getByText('Why it is on your shortlist')).toBeVisible();
  await expect(page.getByText('Ingredients as published')).toBeVisible();
  await expect(page.getByText(/never estimates a concentration/)).toBeVisible();

  // Compare two shortlisted products.
  await page.goto('/shortlist');
  const boxes = page.getByRole('checkbox', { name: 'Compare' });
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await page.getByRole('button', { name: 'Compare selected' }).click();
  await expect(page).toHaveURL(/\/compare\?ids=/);
  await expect(page.getByRole('heading', { name: 'Side by side' })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Verdict for you' })).toBeVisible();

  // Delete everything.
  await page.goto('/privacy');
  await page.getByRole('button', { name: 'Delete my consultation' }).click();
  await expect(page.getByText('Deleted.', { exact: true })).toBeVisible();
  await expect(page.getByText('Nothing is stored for this browser.')).toBeVisible();
  await page.goto('/shortlist');
  await expect(page.getByRole('link', { name: 'Start a consultation' }).last()).toBeVisible();
});

test('a dark photo fails with the documented reason and clear next steps', async ({ page }) => {
  await agreeToAnalysis(page);
  await uploadAndAnalyse(page, true);
  await expect(page.getByRole('heading', { name: 'The analysis could not finish' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('The photo is too dark to analyse. (Simulated by the fixture provider.)')).toBeVisible();
  await expect(page.getByText(/Face a window or a soft light/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Use a different photo' })).toBeVisible();
  await page.getByRole('link', { name: 'Choose goals without an analysis' }).click();
  await expect(page).toHaveURL(/\/consult\/goals$/);
});

test('without a photo, an honest no-match names goals that would have matches', async ({ page }) => {
  await page.goto('/consult');
  await page.getByRole('button', { name: 'Choose goals without a photo' }).click();
  await expect(page).toHaveURL(/\/consult\/goals$/);
  await page.getByLabel(/Balance shine and oil/).check();
  await page.getByRole('button', { name: 'Show my shortlist' }).click();
  await expect(page.getByText(/No product in the catalogue is eligible/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Why nothing qualified' })).toBeVisible();
  await expect(page.getByText(/the catalogue does have eligible products for/)).toBeVisible();
  await expect(page.getByText('No analysis used.')).toBeVisible();
});

test('the goals form refuses an empty choice and keeps what was typed', async ({ page }) => {
  await page.goto('/consult');
  await page.getByRole('button', { name: 'Choose goals without a photo' }).click();
  await expect(page.getByRole('button', { name: 'Show my shortlist' })).toBeDisabled();
  await page.getByLabel(/Support hydration/).check();
  await page.getByLabel('Other ingredients to avoid').fill('x');
  await page.getByRole('button', { name: 'Show my shortlist' }).click();
  await expect(page.getByText('Use at least 3 characters')).toBeVisible();
  await expect(page.getByLabel('Other ingredients to avoid')).toHaveValue('x');
});
