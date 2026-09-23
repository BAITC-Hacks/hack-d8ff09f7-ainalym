// ASSIST-1 — assistant dock in the Fable (v2) shell. Run: ASSIST_URL=http://localhost:3118 npx playwright test tests/e2e/assist.spec.ts --config tests/e2e/assist.config.ts
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.ASSIST_URL ?? "http://localhost:3118";
const PREFIX = process.env.ASSIST_PREFIX ?? "/v2";
const SKU = process.env.ASSIST_SKU ?? "130300027_";
const OUT = "docs/evidence/v2/assist";
mkdirSync(OUT, { recursive: true });
const TECH = /LLM|provider|HTTP|JSON|state_version|ETL|adapter|stack/i;

async function go(page: Page, path: string) { await page.goto(`${BASE}${path}`); await page.locator("html[data-v2='ready']").waitFor({ state: "attached", timeout: 60_000 }); await page.waitForLoadState("networkidle"); }

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 }); });

test("money: ⌘J opens the dock, a chip answers, «Открыть отдельно» opens page mode, Esc closes", async ({ page, context }) => {
  await go(page, `${PREFIX}/money`);
  await expect(page.getByRole("button", { name: /ИИ-ассистент/ })).toBeVisible();
  await page.screenshot({ path: `${OUT}/01_money_closed.png` });
  await page.keyboard.press("Control+j");
  const dock = page.getByRole("dialog", { name: "ИИ-ассистент" });
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
  const popupPromise = context.waitForEvent("page");
  await dock.getByRole("button", { name: "Открыть отдельно" }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  expect(popup.url()).toContain(`${PREFIX}/assistant?ctx=`);
  await expect(dock).toBeHidden();
  await popup.locator("html[data-v2='ready']").waitFor({ state: "attached", timeout: 60_000 });
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
  await page.getByRole("button", { name: /ИИ-ассистент/ }).click();
  const dock = page.getByRole("dialog", { name: "ИИ-ассистент" });
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
