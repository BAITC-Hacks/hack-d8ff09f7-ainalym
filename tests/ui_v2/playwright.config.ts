import { defineConfig, devices } from "@playwright/test";

// Run: npx playwright test -c tests/ui_v2/playwright.config.ts  (a built server must be up, calc run done).
// Projects: desktop/mobile/proof = Today + Replenishment screens; ui2 = Money + SKU card + Supplier draft.
const baseURL = process.env.V2_BASE_URL ?? process.env.V2_BASE ?? "http://127.0.0.1:3210";
const desktop = { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } };
export default defineConfig({
  testDir: ".",
  timeout: 90_000,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: "../../.playwright/ui_v2",
  use: { baseURL, locale: "ru-RU", timezoneId: "Asia/Almaty", colorScheme: "light", headless: true, deviceScaleFactor: 1 },
  projects: [
    { name: "desktop", testMatch: /screens\.spec\.ts/, use: desktop },
    { name: "mobile", testMatch: /screens\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "proof", testMatch: /approve\.spec\.ts/, dependencies: ["desktop", "mobile"], timeout: 240_000, use: desktop },
    { name: "ui2", testMatch: /fable_ui_2\.spec\.ts/, use: desktop },
  ],
});
