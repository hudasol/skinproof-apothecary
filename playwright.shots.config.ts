import { defineConfig } from '@playwright/test';

/** Screenshot capture against its own production build in fixture mode (npm run screenshots). */
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
      PROVIDER_MODE: 'fixture',
      DATA_DIR: './.data-shots',
      FIXTURE_DELAY_MS: '150',
      NEXT_DIST_DIR: '.next-shots',
      SKINPROOF_LOG: 'silent',
      SKINPROOF_INSECURE_COOKIES: '1',
    },
  },
});
