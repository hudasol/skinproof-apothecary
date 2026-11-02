import { defineConfig, devices } from '@playwright/test';

/**
 * The end-to-end suite against a running copy, such as the hosted judging copy
 * (fixture mode only: these tests never call YouCam).
 *
 *   npm run test:e2e:hosted
 *   E2E_BASE_URL=https://example.org npm run test:e2e:hosted
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  workers: 1,
  reporter: [['list']],
  use: { baseURL: process.env.E2E_BASE_URL ?? 'https://skinproof-apothecary.onrender.com' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
});
