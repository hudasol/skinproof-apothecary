import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against their own production build, database and
 * image directory, always in fixture mode: they never call the YouCam API.
 */
const PORT = 3100;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } }, testIgnore: /mobile.spec.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next build && npx next start --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 600_000,
    reuseExistingServer: false,
    env: {
      PROVIDER_MODE: 'fixture',
      DATA_DIR: './.data-e2e',
      FIXTURE_DELAY_MS: '150',
      NEXT_DIST_DIR: '.next-e2e',
      SKINPROOF_LOG: 'silent',
      // Plain http on localhost: the session cookie must not require https.
      SKINPROOF_INSECURE_COOKIES: '1',
    },
  },
});
