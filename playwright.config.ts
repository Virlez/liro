import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  workers: 1,
  webServer: {
    command: 'node scripts/fixture-server.mjs',
    url: 'http://127.0.0.1:4173/article.html',
    reuseExistingServer: true,
  },
  use: { trace: 'retain-on-failure' },
  reporter: [['list'], ['html', { open: 'never' }]],
});
