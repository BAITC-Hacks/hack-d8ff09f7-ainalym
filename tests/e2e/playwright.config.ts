import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: __dirname, testMatch: 'demo.spec.ts', timeout: 20_000,
  expect: { timeout: 8_000 }, retries: 0, workers: 1, fullyParallel: false,
  reporter: [['list'], [require.resolve('./reporter.ts')]], outputDir: 'test-results',
  use: { baseURL: process.env.E2E_BASE_URL, browserName: 'chromium',
    actionTimeout: 20_000, navigationTimeout: 20_000,
    trace: 'off', video: 'off', screenshot: 'off' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
