// @ts-nocheck — @playwright/test is not a repo dependency yet; this spec is run with a locally available Playwright (see OPUS_A_CLOSEOUT).
import { test, expect } from "@playwright/test";

const BASE = process.env.OPUS_A_URL ?? "http://localhost:3110";
const OUT = "docs/evidence/opus_a";
const SKU = process.env.OPUS_A_SKU ?? "130200122_";
const desktop = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };

async function settle(page) { await page.waitForLoadState("networkidle"); await page.waitForTimeout(700); }

test.describe.configure({ mode: "serial" });

test("today — desktop + phone, decision confirm by keyboard, ⌘K", async ({ page }) => {
  await page.setViewportSize(desktop);
  await page.goto(`${BASE}/opus_a/today`); await settle(page);
  await expect(page.getByRole("heading", { level: 1, name: "Сегодня" })).toBeVisible();
  await expect(page.locator(".oa-truth").first()).toContainText("Данные партнёра · обезличены");
  await page.screenshot({ path: `${OUT}/today_desktop.png` });
  await page.screenshot({ path: `${OUT}/today_desktop_full.png`, fullPage: true });
  // keyboard: open the version-bound confirm with Enter, primary action receives focus, Esc closes
  const decide = page.getByRole("button", { name: "Решить…" }).first();
  await decide.focus(); await page.keyboard.press("Enter");
  const confirm = page.getByRole("button", { name: "Подготовить заказ" });
  await expect(confirm).toBeFocused();
  await expect(page.locator(".oa-confirm dl")).toContainText("v");
  await page.locator(".oa-decision").first().screenshot({ path: `${OUT}/today_decision_confirm.png` });
  await page.keyboard.press("Escape");
  await expect(confirm).toHaveCount(0);
  await expect(decide).toBeFocused();
  // stale state: a version-bound approve answered 409 (intercepted in the browser — the DB is not touched)
  await page.route("**/api/proposals/*/approve", route => route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ ok: false, code: "stale", message: "proposal is stale" }) }));
  await decide.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Подготовить заказ" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Данные обновились — обновите")).toBeVisible();
  await page.locator(".oa-decision").first().screenshot({ path: `${OUT}/today_stale_409_state.png` });
  await page.keyboard.press("Escape");
  await page.unroute("**/api/proposals/*/approve");
  // ⌘K focuses the search; typing finds SKUs; Enter opens the card
  await page.keyboard.press("Meta+k");
  const search = page.getByRole("combobox", { name: "Поиск товара" });
  await expect(search).toBeFocused();
  await search.fill("УЗО ВД1");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.screenshot({ path: `${OUT}/today_search_desktop.png` });
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/opus_a\/skus\//);
  await page.setViewportSize(phone); await page.goto(`${BASE}/opus_a/today`); await settle(page);
  await page.screenshot({ path: `${OUT}/today_phone.png` });
  await page.screenshot({ path: `${OUT}/today_phone_full.png`, fullPage: true });
});

test("replenishment — desktop + phone, keyboard rows, rationale row", async ({ page }) => {
  await page.setViewportSize(desktop);
  await page.goto(`${BASE}/opus_a/replenishment`); await settle(page);
  await expect(page.getByRole("heading", { level: 1, name: "Пополнение" })).toBeVisible();
  await page.screenshot({ path: `${OUT}/replenishment_desktop.png` });
  const rows = page.locator("[data-row-toggle]");
  await rows.first().focus(); await page.keyboard.press("ArrowDown");
  await expect(rows.nth(1)).toBeFocused();
  const t0 = await page.evaluate(() => performance.now());
  await page.keyboard.press("Enter");
  await expect(page.locator(".oa-why")).toBeVisible();
  const dt = await page.evaluate((s) => performance.now() - s, t0);
  console.log(`rationale expand latency ≈ ${Math.round(dt)} ms`);
  await expect(rows.nth(1)).toHaveAttribute("aria-expanded", "true");
  await page.waitForTimeout(600);
  await page.locator(".oa-why").scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -240));
  await page.screenshot({ path: `${OUT}/replenishment_rationale_desktop.png` });
  // adjust: the contracted POST /api/recommendations/:id/adjust is not on main yet → honest unavailable state, nothing changes
  await page.getByLabel("Причина (обязательно)").fill("Проверка сохранения");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText(/Сохранено|Сохранение корректировки недоступно|Данные обновились/)).toBeVisible();
  await page.locator(".oa-adjust").screenshot({ path: `${OUT}/replenishment_adjust_state.png` });
  await page.locator(".oa-why input").first().focus(); await page.keyboard.press("Escape");
  await expect(page.locator(".oa-why")).toHaveCount(0);
  await expect(rows.nth(1)).toBeFocused();
  await page.goto(`${BASE}/opus_a/replenishment?supplier=SE`); await settle(page);
  await page.screenshot({ path: `${OUT}/replenishment_se_desktop.png` });
  await page.setViewportSize(phone); await page.goto(`${BASE}/opus_a/replenishment?supplier=SE`); await settle(page);
  await page.screenshot({ path: `${OUT}/replenishment_phone.png` });
  await page.locator("[data-row-toggle]").first().click(); await page.waitForTimeout(600);
  await page.locator(".oa-why").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/replenishment_rationale_phone.png` });
});

test("sku card — desktop + phone", async ({ page }) => {
  await page.setViewportSize(desktop);
  await page.goto(`${BASE}/opus_a/skus/${SKU}`); await settle(page);
  await expect(page.locator("svg.oa-chart")).toBeVisible();
  await page.screenshot({ path: `${OUT}/sku_desktop.png` });
  await page.screenshot({ path: `${OUT}/sku_desktop_full.png`, fullPage: true });
  await page.setViewportSize(phone); await page.goto(`${BASE}/opus_a/skus/${SKU}`); await settle(page);
  await page.screenshot({ path: `${OUT}/sku_phone.png` });
  await page.screenshot({ path: `${OUT}/sku_phone_full.png`, fullPage: true });
  await page.goto(`${BASE}/opus_a/skus/000000000_`); await settle(page);
  await expect(page.getByText("Товар не найден")).toBeVisible();
  await page.screenshot({ path: `${OUT}/sku_not_found_phone.png` });
});
