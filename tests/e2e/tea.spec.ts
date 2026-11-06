import { expect, test } from '@playwright/test';

test('the tea page suggests plants for low moisture and ends with one blend', async ({ page }) => {
  await page.goto('/tea?goals=support_hydration&goals=smooth_fine_lines');
  await expect(page.getByRole('heading', { name: 'Herbal teas for your focus areas' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Support hydration and the skin barrier' })).toBeVisible();
  await expect(page.getByText('Roselle / hibiscus flower').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your blend' })).toBeVisible();
  await expect(page.getByText('no study tested these plants together')).toBeVisible();
});

test('a goal with no tea evidence says so and offers no blend', async ({ page }) => {
  await page.goto('/tea?goals=even_tone');
  await expect(page.getByText('No herbal tea has been tested or traditionally used for this goal').first()).toBeVisible();
  await expect(page.getByText('No tea qualifies for a blend')).toBeVisible();
});
