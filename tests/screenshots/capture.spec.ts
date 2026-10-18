/**
 * Capture README and submission screenshots from a production build.
 *
 *   npm run screenshots                     # fixture mode, files named fixture-*.png
 *   SHOT_PREFIX=live npm run screenshots    # only after switching the server to live mode
 *
 * Uses a fresh browser session and a synthetic, non-photographic portrait, so
 * in fixture mode every analysis and try-on image is a labelled placeholder.
 */
import fs from 'node:fs';
import path from 'node:path';
import { test, type Browser, type Page } from '@playwright/test';
import sharp from 'sharp';

const base = process.env.SHOT_BASE_URL ?? 'http://localhost:3200';
const prefix = process.env.SHOT_PREFIX ?? 'fixture';
const out = path.join(process.cwd(), 'docs', 'screenshots');

async function portrait(): Promise<Buffer> {
  // Live mode needs a real face: the YouCam documentation's own sample portrait, cropped so the face fills the frame.
  const url = process.env.SHOT_PORTRAIT_URL;
  if (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Could not fetch the sample portrait');
    const img = sharp(Buffer.from(await res.arrayBuffer()));
    const { width = 0, height = 0 } = await img.metadata();
    return img.extract({ left: Math.round(width * 0.15), top: Math.round(height * 0.12), width: Math.round(width * 0.73), height: Math.round(height * 0.85) }).jpeg({ quality: 93 }).toBuffer();
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><rect width="100%" height="100%" fill="#8a9a91"/><ellipse cx="450" cy="560" rx="300" ry="400" fill="#d9b49c"/><ellipse cx="450" cy="790" rx="90" ry="30" fill="#b5675f"/></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}

async function shot(page: Page, name: string, opts: { fullPage?: boolean; selector?: string } = {}) {
  await page.waitForTimeout(400);
  const file = path.join(out, `${prefix}-${name}.png`);
  if (opts.selector) await page.locator(opts.selector).first().screenshot({ path: file });
  else await page.screenshot({ path: file, fullPage: opts.fullPage ?? false });
  console.log(path.relative(process.cwd(), file));
}

test.setTimeout(300_000);

test('capture screenshots', async ({ browser }) => {
  await capture(browser);
});

async function capture(browser: Browser) {
  fs.mkdirSync(out, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });

  await page.goto(`${base}/`);
  await page.waitForTimeout(1200);
  await shot(page, '01-landing');
  await page.goto(`${base}/library`);
  await shot(page, '02-library');
  await page.goto(`${base}/library/tea-tree`);
  await shot(page, '03-botanical', { fullPage: false });

  await page.goto(`${base}/consult`);
  await page.getByLabel(/Analyse my photo with YouCam Skin AI/).check();
  await page.getByLabel(/Also use my photo for lip colour try-on/).check();
  await shot(page, '04-consent');
  await page.getByRole('button', { name: 'Agree and continue' }).click();
  await page.getByLabel('Your photo').setInputFiles({ name: 'p.jpg', mimeType: 'image/jpeg', buffer: await portrait() });
  await shot(page, '05-photo');
  await page.getByRole('button', { name: 'Analyse my skin' }).click();
  await page.getByRole('heading', { name: 'What the analysis saw' }).waitFor({ timeout: 60_000 });
  await shot(page, '06-analysis', { fullPage: true });

  await page.getByRole('link', { name: 'Choose your goals' }).click();
  await page.getByLabel(/No added fragrance/).check();
  await shot(page, '07-goals');
  await page.getByRole('button', { name: 'Show my shortlist' }).click();
  await page.getByRole('heading', { name: 'Your shortlist' }).waitFor();
  await shot(page, '08-shortlist', { fullPage: true });

  const first = page.locator('ol li h3 a').first();
  await first.click();
  await page.getByText('Ingredients as published').waitFor();
  await shot(page, '09-dossier', { fullPage: true });

  await page.goto(`${base}/products/weleda-skin-food`);
  await shot(page, '10-excluded-dossier', { fullPage: true });

  await page.goto(`${base}/shortlist`);
  const boxes = page.getByRole('checkbox', { name: 'Compare' });
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await boxes.nth(2).check();
  await page.getByRole('button', { name: 'Compare selected' }).click();
  await page.getByRole('heading', { name: 'Side by side' }).waitFor();
  await shot(page, '11-compare', { fullPage: true });

  // Lift the fragrance limit for the colour studio, then try a shade on.
  await page.goto(`${base}/consult/goals`);
  await page.getByLabel(/No added fragrance/).uncheck();
  await page.getByRole('button', { name: 'Show my shortlist' }).click();
  await page.getByRole('heading', { name: 'Your shortlist' }).waitFor();
  await page.goto(`${base}/colour`);
  await shot(page, '12-colour-shelf');
  await page.goto(`${base}/colour/hurraw-tinted-lip-balm?shade=black-cherry`);
  await page.getByRole('button', { name: /Try Black Cherry on my photo/ }).click();
  await page.locator('figure input[type=range]').waitFor({ timeout: 60_000 });
  await shot(page, '13-tryon', { fullPage: true });

  await page.goto(`${base}/ledger`);
  await shot(page, '14-ledger');

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  await phone.goto(`${base}/`);
  await phone.waitForTimeout(1200);
  await shot(phone, '15-mobile-landing');
}

