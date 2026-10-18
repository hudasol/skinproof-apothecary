import { expect, type Page } from '@playwright/test';
import sharp from 'sharp';

/** A synthetic, non-photographic portrait: an oval on a gradient. The repo ships no photos of people. */
export async function syntheticPortrait(opts: { dark?: boolean } = {}): Promise<Buffer> {
  const w = 900;
  const h = 1200;
  const bg = opts.dark ? '#0b0b0b' : '#8a9a91';
  const face = opts.dark ? '#151515' : '#d9b49c';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${bg}"/><ellipse cx="450" cy="560" rx="300" ry="400" fill="${face}"/><ellipse cx="450" cy="790" rx="90" ry="30" fill="${opts.dark ? '#1a1a1a' : '#b5675f'}"/></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}

export async function agreeToAnalysis(page: Page, alsoTryOn = false) {
  await page.goto('/consult');
  await page.getByLabel(/Analyse my photo with YouCam Skin AI/).check();
  if (alsoTryOn) await page.getByLabel(/Also use my photo for lip colour try-on/).check();
  await page.getByRole('button', { name: 'Agree and continue' }).click();
  await expect(page).toHaveURL(/\/consult\/photo$/);
}

export async function uploadAndAnalyse(page: Page, dark = false) {
  await page.getByLabel('Your photo').setInputFiles({ name: 'portrait.jpg', mimeType: 'image/jpeg', buffer: await syntheticPortrait({ dark }) });
  await expect(page.getByRole('slider', { name: /Crop area/ })).toBeVisible();
  await page.getByRole('button', { name: 'Analyse my skin' }).click();
  await expect(page).toHaveURL(/\/consult\/analysis$/);
}
