import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  timeout: 90_000,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: { baseURL: process.env.V2_BASE ?? "http://127.0.0.1:3220", headless: true, deviceScaleFactor: 1 },
  outputDir: "../../docs/evidence/v2/fable_ui_2/.pw",
});
