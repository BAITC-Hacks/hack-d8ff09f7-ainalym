// @ts-nocheck — same conventions as opus_a.spec.ts; run against a local server (V2_URL, default :3110).
import { test, expect } from "@playwright/test";

const BASE = process.env.V2_URL ?? "http://localhost:3110";
const OUT = "docs/evidence/v2/suppliers";

test("suppliers — desktop 1440×900, IEK / SE cards from real data, no technical terms", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/suppliers`);
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("heading", { level: 2, name: /IEK/ })).toBeVisible({ timeout: 15_000 }); await page.waitForTimeout(700);
  await expect(page.getByRole("heading", { level: 1, name: "Поставщики" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /IEK/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /System Electric/ })).toBeVisible();
  await expect(page.getByText("Срок поставки").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Закупки IEK/ })).toHaveAttribute("href", "/replenishment?supplier=IEK");
  await expect(page.getByRole("link", { name: /Заказы SE/ })).toHaveAttribute("href", "/orders?supplier=SE");
  const body = await page.locator("main").innerText();
  for (const banned of ["state_version", "JSON", "HTTP", "ETL", "null", "undefined", "NaN", "api/"]) expect(body).not.toContain(banned);
  await page.screenshot({ path: `${OUT}/suppliers_desktop.png` });
  await page.screenshot({ path: `${OUT}/suppliers_desktop_full.png`, fullPage: true });
});
