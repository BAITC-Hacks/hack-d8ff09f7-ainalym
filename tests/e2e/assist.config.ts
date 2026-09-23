import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: __dirname, testMatch: "assist.spec.ts", timeout: 60_000, retries: 0, workers: 1,
  reporter: "list", outputDir: "../../test-results/assist",
  use: { browserName: "chromium", headless: true, deviceScaleFactor: 1, trace: "off", video: "off", screenshot: "off" },
});
