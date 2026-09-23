// @ts-nocheck — same local-Playwright setup as the other e2e specs.
import { test, expect } from "@playwright/test";

const BASE = process.env.OPUS_A_URL ?? "http://localhost:3120";
const OUT = "docs/evidence/v2/orders";

test("orders — pipeline list, stage rail, evidence rail (1440×900)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/orders`);
  await page.waitForLoadState("networkidle"); await page.waitForTimeout(800);
  await expect(page.getByRole("heading", { level: 1, name: "Заказы" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Этапы заказа" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Документы" })).toBeVisible();
  const body = await page.locator("body").innerText();
  for (const term of ["state_version", "JSON", "HTTP", "ETL", "provider", "undefined", "null"]) expect(body, `no technical term «${term}»`).not.toContain(term);
  await page.screenshot({ path: `${OUT}/orders_desktop.png` });
  await page.screenshot({ path: `${OUT}/orders_desktop_full.png`, fullPage: true });
});
