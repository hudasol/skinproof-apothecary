import { defineConfig } from '@playwright/test';

/**
 * Screenshot capture against its own production build (npm run screenshots).
 * Fixture mode by default. SHOT_MODE=live calls YouCam (one analysis and one
 * try-on, about 15 units) using the key in .env.local; use it only with approval.
 */
const PORT = 3200;

export default defineConfig({
  testDir: 'tests/screenshots',
  workers: 1,
  reporter: [['list']],
  webServer: {
    command: `npx next build && npx next start --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 600_000,
    reuseExistingServer: false,
    env: {
      PROVIDER_MODE: process.env.SHOT_MODE === 'live' ? 'live' : 'fixture',
      DATA_DIR: process.env.SHOT_MODE === 'live' ? './.data-shots-live' : './.data-shots',
      FIXTURE_DELAY_MS: '150',
      NEXT_DIST_DIR: '.next-shots',
      SKINPROOF_LOG: 'silent',
      SKINPROOF_INSECURE_COOKIES: '1',
    },
  },
});
