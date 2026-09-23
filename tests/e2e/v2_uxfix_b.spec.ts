// @ts-nocheck — same conventions as v2_suppliers.spec.ts; run against a local server (V2_URL, default :3110).
import { test, expect } from "@playwright/test";

const BASE = process.env.V2_URL ?? "http://localhost:3110";
const OUT = "docs/evidence/v2/uxfix_b";
const BANNED = ["state_version", "JSON", "HTTP", "ETL", "null", "undefined", "NaN", "api/", "LLM", "jev", "obligation.", "purchase_order", "unit_cost", "sku.", "due_at", "opening_cash", "prepay_pct", "_id", "Симулятор"];

test("money — gaps become «Заполнить» buttons, no technical terms", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/money`);
  await expect(page.getByRole("heading", { level: 1, name: "Деньги" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 2, name: "Обязательства по поставщикам" })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(600);
  const gaps = page.getByRole("heading", { level: 2, name: "Что заполнить, чтобы видеть деньги полностью" });
  if (await gaps.isVisible()) {
    const fill = page.locator("main").getByRole("link", { name: /^(Заполнить|Где взять)$/ });
    expect(await fill.count()).toBeGreaterThan(0);
    const hrefs = await fill.evaluateAll(links => links.map(l => l.getAttribute("href")));
    for (const href of hrefs) expect(href).toMatch(/^\/settings#(opening_cash|cost)$/);
  }
  const body = await page.locator("main").innerText();
  for (const banned of BANNED) expect(body, banned).not.toContain(banned);
  const titles = await page.locator("main [title]").evaluateAll(els => els.map(e => e.getAttribute("title") ?? ""));
  for (const t of titles) for (const banned of BANNED) expect(t, banned).not.toContain(banned);
  await page.screenshot({ path: `${OUT}/money_desktop.png` });
  await page.screenshot({ path: `${OUT}/money_desktop_full.png`, fullPage: true });
});

test("settings — one page for the owner's inputs, plain Russian, nav has Настройки and no Связи", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/settings`);
  await expect(page.getByRole("heading", { level: 1, name: "Настройки" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 2, name: "Деньги" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Поставки" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Себестоимость" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Откуда данные" })).toBeVisible();
  await expect(page.getByLabel("Остаток денег на счетах")).toBeVisible();
  await expect(page.getByText(/товаров без себестоимости из/)).toBeVisible();
  const nav = page.locator('aside[aria-label="Разделы"]');
  await expect(nav.getByRole("link", { name: "Настройки" })).toHaveAttribute("href", "/settings");
  await expect(nav.getByRole("link", { name: "Связи" })).toHaveCount(0);
  const body = await page.locator("main").innerText();
  for (const banned of BANNED) expect(body, banned).not.toContain(banned);
  await page.screenshot({ path: `${OUT}/settings_desktop.png` });
  await page.screenshot({ path: `${OUT}/settings_desktop_full.png`, fullPage: true });
  await page.goto(`${BASE}/connections`);
  await expect(page).toHaveURL(/\/settings#sources$/, { timeout: 20_000 });
});
