import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3102';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  workers: 1,
  use: { baseURL, browserName: 'chromium', channel: 'msedge', headless: true },
});
