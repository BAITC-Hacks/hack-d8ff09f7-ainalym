import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const EVIDENCE = join(__dirname, "..", "..", "docs", "evidence", "v2", "fable_ui_1");
mkdirSync(EVIDENCE, { recursive: true });
const shot = (page: Page, name: string, vp: string) => page.screenshot({ path: join(EVIDENCE, `${name}_${vp}.png`), fullPage: true, animations: "disabled" });
const vpName = (page: Page) => (page.viewportSize()!.width > 600 ? "1440x900" : "390x844");

const errors: string[] = []; const bad: string[] = []; let expectBad = false;
// Chrome logs every non-2xx fetch as "Failed to load resource"; those are tracked separately as `bad` and only allowed in tests that deliberately return 4xx/5xx.
test.beforeEach(({ page }) => {
  expectBad = false;
  page.on("console", m => { if (m.type() === "error" && !m.text().includes("/_next/hmr") && !m.text().startsWith("Failed to load resource")) errors.push(m.text()); });
  page.on("pageerror", e => errors.push(String(e)));
  page.on("response", r => { if (r.status() >= 400 && !r.url().includes("/brand/")) bad.push(`${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, "")}`); });
});
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: "ignoreErrors" }); expect(errors, "no console errors").toEqual([]); if (!expectBad) expect(bad, "no failed requests").toEqual([]); errors.length = 0; bad.length = 0; });

test.describe("Today / Pulse", () => {
  test("populated", async ({ page }) => {
    await page.goto("/v2/today");
    await expect(page.getByRole("heading", { level: 1, name: "Сегодня" })).toBeVisible();
    await expect(page.getByText("Стоимость запаса")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Требует вашего решения")).toBeVisible();
    const card = page.getByRole("article").filter({ has: page.getByRole("button", { name: "Подготовить заказ" }) }).first();
    await expect(card.getByRole("button", { name: "Подготовить заказ" })).toBeEnabled({ timeout: 40_000 });
    await shot(page, "today_populated", vpName(page));
  });
  test("empty", async ({ page }) => {
    await page.route("**/api/queue", r => r.fulfill({ json: { ok: true, items: [], empty_reason: "Расчёт ещё не запускался — агенты ждут первого события.", state_version: 1 } }));
    await page.route("**/api/today", async r => { const j = await (await r.fetch()).json(); r.fulfill({ json: { ...j, decision: null, lead: "Решений нет — агенты работают.", queue_count: 0 } }); });
    await page.goto("/v2/today");
    await expect(page.getByText("Решений нет — агенты работают")).toBeVisible();
    await shot(page, "today_empty", vpName(page));
  });
  test("unavailable", async ({ page }) => {
    expectBad = true;
    await page.route("**/api/today", r => r.fulfill({ status: 503, json: { ok: false, code: "provider_unavailable", message: "База данных недоступна: ETL не выполнен." } }));
    await page.route("**/api/queue", r => r.fulfill({ status: 503, json: { ok: false, code: "provider_unavailable", message: "База данных недоступна: ETL не выполнен." } }));
    await page.goto("/v2/today");
    await expect(page.getByRole("status").filter({ hasText: "Раздел недоступен" }).first()).toBeVisible();
    await shot(page, "today_unavailable", vpName(page));
  });
  test("stale 409 on approve", async ({ page }) => {
    expectBad = true;
    await page.route("**/api/proposals/*/approve", r => r.fulfill({ status: 409, json: { ok: false, code: "stale", message: "proposal is stale" } }));
    await page.goto("/v2/today");
    const card = page.getByRole("article").filter({ has: page.getByRole("button", { name: "Подготовить заказ" }) }).first();
    const approve = card.getByRole("button", { name: "Подготовить заказ" });
    await expect(approve).toBeEnabled({ timeout: 40_000 });
    await approve.click();
    await expect(card.getByRole("alert")).toContainText("Данные обновились");
    await shot(page, "today_stale409", vpName(page));
  });
  test("offline", async ({ page, context }) => {
    await page.goto("/v2/today");
    await expect(page.getByRole("article").first()).toBeVisible({ timeout: 40_000 });
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.getByRole("status").filter({ hasText: "Нет связи" }).first()).toBeVisible({ timeout: 15_000 });
    await shot(page, "today_offline", vpName(page));
    await context.setOffline(false);
  });
});

test.describe("Replenishment", () => {
  test("populated + expanded rationale + keyboard", async ({ page }) => {
    await page.goto("/v2/replenishment?supplier=SE");
    await expect(page.getByRole("heading", { level: 1, name: "Пополнение" })).toBeVisible();
    await expect(page.locator("tr[role=button]").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("tr[role=button]").first().locator("td").nth(7)).not.toContainText("не задана", { timeout: 15_000 });
    await shot(page, "replenishment_populated", vpName(page));
    // keyboard: j focuses first row, Enter expands, Esc collapses, / focuses search
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("j");
    const first = page.locator("tr[role=button]").first();
    await expect(first).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(first).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("Как получилось число")).toBeVisible();
    await shot(page, "replenishment_expanded", vpName(page));
    await page.keyboard.press("Escape");
    await expect(first).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("/");
    await expect(page.getByRole("searchbox", { name: "Фильтр по названию или коду 1С" })).toBeFocused();
    await page.keyboard.type("zzzz-нет-такого");
    await expect(page.getByText("Ничего не найдено по фильтру")).toBeVisible();
    await shot(page, "replenishment_filtered_empty", vpName(page));
  });
  test("empty (no run)", async ({ page }) => {
    await page.route("**/api/recommendations", r => r.fulfill({ json: { ok: true, ai: "rules", external: "export_only", groups: [], state_version: 1 } }));
    await page.goto("/v2/replenishment");
    await expect(page.getByText("Расчёт ещё не запускался")).toBeVisible();
    await shot(page, "replenishment_empty", vpName(page));
  });
  test("unavailable", async ({ page }) => {
    expectBad = true;
    await page.route("**/api/recommendations", r => r.fulfill({ status: 503, json: { ok: false, code: "provider_unavailable", message: "База данных недоступна." } }));
    await page.goto("/v2/replenishment");
    await expect(page.getByRole("status").filter({ hasText: "Раздел недоступен" })).toBeVisible();
    await shot(page, "replenishment_unavailable", vpName(page));
  });
  test("stale 409 on prepare order", async ({ page }) => {
    expectBad = true;
    await page.route("**/api/proposals/*/approve", r => r.fulfill({ status: 409, json: { ok: false, code: "stale", message: "proposal is stale" } }));
    await page.goto("/v2/replenishment?supplier=SE");
    const btn = page.getByRole("button", { name: /Подготовить заказ SE/ });
    await expect(btn).toBeEnabled({ timeout: 20_000 });
    await btn.click();
    await expect(page.getByRole("alert").filter({ hasText: "Данные обновились" })).toBeVisible();
    await shot(page, "replenishment_stale409", vpName(page));
  });
});
