import { defineConfig, devices } from "@playwright/test";

// Run: npx playwright test -c tests/ui_v2/playwright.config.ts  (dev server on :3210 must be up, calc run done)
export default defineConfig({
  testDir: ".",
  timeout: 60_000,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: "../../.playwright/ui_v2",
  use: { baseURL: process.env.V2_BASE_URL ?? "http://127.0.0.1:3210", locale: "ru-RU", timezoneId: "Asia/Almaty", colorScheme: "light" },
  projects: [
    { name: "desktop", testMatch: /screens\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", testMatch: /screens\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "sku-money-supplier", testMatch: /fable_ui_2\.spec\.ts/, use: { ...devices["Desktop Chrome"], deviceScaleFactor: 1 } },
    { name: "proof", testMatch: /approve\.spec\.ts/, dependencies: ["desktop", "mobile"], timeout: 240_000, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
});
