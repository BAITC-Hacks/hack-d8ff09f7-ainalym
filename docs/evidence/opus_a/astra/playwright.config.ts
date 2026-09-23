import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '../../../../tests/e2e', testMatch: 'opus_a.spec.ts',
  timeout: 90_000, expect: { timeout: 10_000 }, workers: 1, retries: 0,
  reporter: [['list'], ['json', { outputFile: './playwright-results.json' }]],
  outputDir: './test-results', use: { baseURL: 'http://localhost:3111', browserName: 'chromium', viewport: { width: 1440, height: 900 }, trace: 'off', screenshot: 'off' },
});
