// ASSIST-1 — assistant dock in the Fable (v2) shell. Run: ASSIST_URL=http://localhost:3118 npx playwright test tests/e2e/assist.spec.ts --config tests/e2e/assist.config.ts
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.ASSIST_URL ?? "http://localhost:3118";
const PREFIX = process.env.ASSIST_PREFIX ?? "";
const SKU = process.env.ASSIST_SKU ?? "130300027_";
const OUT = "docs/evidence/v2/assist";
mkdirSync(OUT, { recursive: true });
const TECH = /LLM|provider|HTTP|JSON|state_version|ETL|adapter|stack/i;

async function go(page: Page, path: string) { await page.goto(`${BASE}${path}`); await page.locator('aside[aria-label="Разделы"] nav').waitFor({ state: "attached", timeout: 60_000 }); await page.waitForLoadState("networkidle"); }

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 }); });

test("money: ⌘J opens the dock, a chip answers, «Открыть отдельно» opens page mode, Esc closes", async ({ page, context }) => {
  await go(page, `${PREFIX}/money`);
  await expect(page.getByRole("button", { name: /Спросить помощника/ })).toBeVisible();
  await page.screenshot({ path: `${OUT}/01_money_closed.png` });
  await page.keyboard.press("Control+j");
  const dock = page.getByRole("dialog", { name: "Помощник" });
  await expect(dock).toBeVisible();
  await expect(dock.getByText("Деньги", { exact: true })).toBeVisible();
  await page.screenshot({ path: `${OUT}/02_money_dock_open.png` });
  await dock.getByRole("button", { name: "Что заплатить на этой неделе?" }).click();
  const card = dock.getByRole("article", { name: "Что заплатить на этой неделе?" });
  await expect(card).toBeVisible({ timeout: 20_000 });
  expect(await card.innerText()).not.toMatch(TECH);
  await dock.getByRole("button", { name: "Что срочно?" }).click();
  await expect(dock.getByRole("article", { name: "Что срочно?" })).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `${OUT}/03_money_answers.png` });
  await page.screenshot({ path: "docs/evidence/v2/assist2/05_dock_open_answers_1440.png" });
  const popupPromise = context.waitForEvent("page");
  await dock.getByRole("button", { name: "Открыть отдельно" }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  expect(popup.url()).toContain(`${PREFIX}/assistant?ctx=`);
  await expect(dock).toBeHidden();
  await popup.getByRole("region", { name: "Помощник" }).waitFor({ state: "attached", timeout: 60_000 });
  await popup.setViewportSize({ width: 480, height: 760 });
  await expect(popup.getByRole("article", { name: "Что заплатить на этой неделе?" })).toBeVisible();
  await popup.screenshot({ path: `${OUT}/04_popup_page_mode.png` });
  await popup.close();
  await page.keyboard.press("Control+j");
  await expect(dock).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dock).toBeHidden();
});

test("sku: both chips get data-backed answers with links onto the shell", async ({ page }) => {
  await go(page, `${PREFIX}/skus/${SKU}`);
  await page.getByRole("button", { name: /Спросить помощника/ }).click();
  const dock = page.getByRole("dialog", { name: "Помощник" });
  await expect(dock.getByText(`Позиция ${SKU}`, { exact: true })).toBeVisible();
  await dock.getByRole("button", { name: "Почему столько?" }).click();
  await expect(dock.getByRole("article", { name: "Почему столько?" })).toBeVisible({ timeout: 20_000 });
  await dock.getByRole("button", { name: "Что изменится, если +100 в пути?" }).click();
  const card = dock.getByRole("article", { name: "Что изменится, если +100 в пути?" });
  await expect(card).toBeVisible({ timeout: 20_000 });
  expect(await card.innerText()).not.toMatch(TECH);
  await expect(card.getByRole("link", { name: /Открыть карточку/ })).toHaveAttribute("href", `${PREFIX}/skus/${SKU}`);
  await page.screenshot({ path: `${OUT}/05_sku_answers.png` });
});

// ASSIST-2 — /assistant is the full-width conversation surface (transcript, inline cards, quick actions, mic).
test("assistant page: chip → inline card, typed «почему 130200122» → SKU card, mobile layout", async ({ page }) => {
  const OUT2 = "docs/evidence/v2/assist2";
  mkdirSync(OUT2, { recursive: true });
  await go(page, `${PREFIX}/assistant`);
  const surface = page.getByRole("region", { name: "Помощник" });
  await expect(surface.getByRole("heading", { name: "Помощник", level: 1 })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Помощник" })).toHaveCount(0);
  const mic = surface.getByRole("button", { name: "Микрофон вкл/выкл" });
  await expect(mic).toBeVisible();
  await expect(mic).toHaveAttribute("aria-pressed", "false");
  expect((await mic.boundingBox())?.width ?? 0).toBeLessThanOrEqual(44);
  await page.screenshot({ path: `${OUT2}/01_assistant_empty_1440.png` });
  if (await mic.isEnabled()) {
    // Toggle on inside a click; with no voice provider the session reports unavailable in plain Russian and the toggle stays off.
    await mic.click();
    await expect.poll(async () => (await mic.getAttribute("aria-pressed")) === "true" || /Голос сейчас недоступен/.test(await surface.getByRole("status").first().innerText()), { timeout: 15_000 }).toBe(true);
    if ((await mic.getAttribute("aria-pressed")) === "true") { await mic.click(); await expect(mic).toHaveAttribute("aria-pressed", "false"); }
  } else {
    await expect(surface.getByText("Голос сейчас недоступен — печатайте")).toBeVisible();
  }
  await surface.getByRole("button", { name: "Что нужно от меня?" }).click();
  const queue = surface.getByRole("article", { name: "Что нужно от меня?" });
  await expect(queue).toBeVisible({ timeout: 20_000 });
  expect(await queue.innerText()).not.toMatch(TECH);
  await page.keyboard.press("Control+k");
  await expect(surface.getByRole("textbox", { name: "Вопрос ассистенту" })).toBeFocused();
  await page.keyboard.type("почему 130200122");
  await page.keyboard.press("Enter");
  const sku = surface.getByRole("article", { name: "почему 130200122" });
  await expect(sku).toBeVisible({ timeout: 20_000 });
  expect(await sku.innerText()).not.toMatch(TECH);
  await expect(sku.getByRole("link", { name: /Открыть карточку 130200122_/ })).toHaveAttribute("href", `${PREFIX}/skus/130200122_`);
  await page.screenshot({ path: `${OUT2}/02_assistant_cards_1440.png`, fullPage: true });
  // Phone: a real load at 390 (the shared thread comes back from storage), not a desktop resize.
  await page.setViewportSize({ width: 390, height: 844 });
  await go(page, `${PREFIX}/assistant`);
  await expect(surface.getByRole("article", { name: "почему 130200122" })).toBeVisible();
  await expect(surface.getByRole("button", { name: "Микрофон вкл/выкл" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: `${OUT2}/03_assistant_390.png` });
  // The dock still works on other pages and shares the same conversation.
  await page.setViewportSize({ width: 1440, height: 900 });
  await go(page, `${PREFIX}/money`);
  await page.keyboard.press("Control+j");
  const dock = page.getByRole("dialog", { name: "Помощник" });
  await expect(dock).toBeVisible();
  await expect(dock.getByRole("article", { name: "почему 130200122" })).toBeVisible();
  await page.screenshot({ path: `${OUT2}/04_dock_shared_thread.png` });
});

test("dock at 390: ⌘J opens an opaque chat sheet, a chip answers, a typed question answers", async ({ page }) => {
  const OUT2 = "docs/evidence/v2/assist2";
  mkdirSync(OUT2, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await go(page, `${PREFIX}/money`);
  await page.keyboard.press("Control+j");
  const dock = page.getByRole("dialog", { name: "Помощник" });
  await expect(dock).toBeVisible();
  await expect(dock.getByRole("heading", { name: "Помощник" })).toBeVisible();
  expect(await dock.evaluate(node => getComputedStyle(node).backgroundColor)).not.toMatch(/rgba\(\d+, \d+, \d+, 0\)|transparent/);
  await page.screenshot({ path: `${OUT2}/06_dock_390_open.png` });
  await dock.getByRole("button", { name: "Что срочно?" }).click();
  await expect(dock.getByRole("article", { name: "Что срочно?" })).toBeVisible({ timeout: 20_000 });
  await dock.getByRole("textbox", { name: "Вопрос ассистенту" }).fill("почему 130200122");
  await page.keyboard.press("Enter");
  const card = dock.getByRole("article", { name: "почему 130200122" });
  await expect(card).toBeVisible({ timeout: 20_000 });
  expect(await card.innerText()).not.toMatch(TECH);
  await page.screenshot({ path: `${OUT2}/07_dock_390_answers.png` });
});
