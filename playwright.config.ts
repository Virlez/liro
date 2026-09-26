import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  workers: 1,
  webServer: {
    command: 'node scripts/fixture-server.mjs',
    port: 4173,
    reuseExistingServer: true,
  },
  use: { trace: 'retain-on-failure' },
  reporter: [['list'], ['html', { open: 'never' }]],
});
