import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT = resolve(__dirname, "../../docs/evidence/v2/fable_ui_2");
mkdirSync(OUT, { recursive: true });
const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } } as const;
const consoleLog: Record<string, string[]> = {};

function watch(page: Page, key: string) {
  consoleLog[key] ??= [];
  // Browser "Failed to load resource" lines carry no URL; record the failing response instead so every entry names its route.
  page.on("console", m => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) consoleLog[key].push(m.text()); });
  page.on("response", r => { if (r.status() >= 400) consoleLog[key].push(`http ${r.status()} ${new URL(r.url()).pathname}`); });
  page.on("pageerror", e => consoleLog[key].push(`pageerror: ${e.message}`));
}
async function shot(page: Page, name: string, size: keyof typeof SIZES) {
  await page.setViewportSize(SIZES[size]);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}_${size}.png`, fullPage: true });
}
async function both(page: Page, name: string) { await shot(page, name, "desktop"); await shot(page, name, "phone"); }
/** goto + wait until the v2 shell has hydrated (the shell stamps html[data-v2=ready] from an effect). */
async function go(page: Page, url: string) { await page.goto(url); await page.locator("html[data-v2='ready']").waitFor({ state: "attached", timeout: 60_000 }); }

/** Mint a fresh approved purchase order through the contract routes so the supplier channel starts at «Черновик заказа — не отправлен». */
async function freshOrder(page: Page): Promise<string> {
  const base = process.env.V2_BASE ?? "http://127.0.0.1:3220";
  await page.request.post(`${base}/api/calc/run`, { data: {} });
  const proposals = (await (await page.request.get(`${base}/api/proposals`)).json()) as { proposals: { id: string; kind: string; subject_id: string; state: string; version: number }[] };
  const candidate = proposals.proposals.find(p => p.kind === "supplier_order" && p.state === "needs_review" && p.subject_id === "SE") ?? proposals.proposals.find(p => p.kind === "supplier_order" && p.state === "needs_review");
  if (!candidate) throw new Error("no needs_review supplier_order proposal");
  const approved = (await (await page.request.post(`${base}/api/proposals/${candidate.id}/approve`, { data: { proposal_version: candidate.version } })).json()) as { po_id: string };
  const order = (await (await page.request.get(`${base}/api/orders/${approved.po_id}`)).json()) as { order: { version: number } };
  await page.request.post(`${base}/api/orders/${approved.po_id}/approve`, { data: { version: order.order.version } });
  return approved.po_id;
}

test.afterAll(() => { writeFileSync(`${OUT}/console_errors.json`, JSON.stringify(consoleLog, null, 2)); });

test("sku card — populated, outliers, no recommendation, in-transit, 404, unavailable, stale-409", async ({ page }) => {
  watch(page, "sku");
  await go(page, "/v2/skus/130300027_");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Сжим");
  await expect(page.getByText("Исключённые разовые документы")).toBeVisible();
  await page.locator("g[tabindex]").nth(21).hover();
  await both(page, "sku_populated_outliers");
  // keyboard: tab into the chart, arrow right, Enter pins the tooltip
  await page.locator("g[tabindex]").first().focus();
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Продажи по файлу" })).toBeVisible();
  await page.keyboard.press("Escape");
  await go(page, "/v2/skus/010500008_");
  await expect(page.getByText("ETA 01.11.2026").first()).toBeVisible();
  await both(page, "sku_in_transit");
  await go(page, "/v2/skus/130200032_");
  await expect(page.getByText("Рекомендации нет")).toBeVisible();
  await both(page, "sku_no_recommendation_stockouts");
  await go(page, "/v2/skus/NOPE_");
  await expect(page.getByText("Позиция не найдена")).toBeVisible();
  await both(page, "sku_404");
  await page.route("**/api/skus/130300027_", r => r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, code: "provider_unavailable", message: "База недоступна" }) }));
  await go(page, "/v2/skus/130300027_");
  await expect(page.getByText("Карточка недоступна")).toBeVisible();
  await both(page, "sku_unavailable");
  await page.unroute("**/api/skus/130300027_");
  await page.route("**/api/recommendations/*/adjust", r => r.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ ok: false, code: "stale", message: "version mismatch" }) }));
  await go(page, "/v2/skus/130300027_");
  await page.getByRole("button", { name: "Скорректировать" }).click();
  await page.getByLabel(/Количество/).fill("1540");
  await page.getByLabel("Причина").fill("акция у клиента");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Данные обновились")).toBeVisible();
  await both(page, "sku_stale_409");
  await page.unroute("**/api/recommendations/*/adjust");
  await go(page, "/v2/skus/130300027_");
  await page.getByRole("button", { name: "Скорректировать" }).click();
  await page.getByLabel(/Количество/).fill("1540");
  await page.getByLabel("Причина").fill("акция у клиента");
  await page.getByRole("button", { name: /Сохранить/ }).click();
  await expect(page.getByText(/Корректировка недоступна|сохранено|Данные обновились/)).toBeVisible();
  await shot(page, "sku_adjust_route_missing", "desktop");
});

test("money — populated, empty, unavailable, stale", async ({ page }) => {
  watch(page, "money");
  await go(page, "/v2/money");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Деньги");
  await expect(page.getByText("Systeme Electric").first()).toBeVisible();
  await both(page, "money_populated");
  await page.route("**/api/money", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, ai: "rules", cash: [], committed_by_supplier: [], next_60d: { out: [] }, stock_value: null, risks: [], state_version: 1 }) }));
  await go(page, "/v2/money");
  await expect(page.getByText("Утверждённых заказов пока нет")).toBeVisible();
  await both(page, "money_empty");
  await page.route("**/api/money", r => r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false, code: "internal", message: "Ошибка расчёта" }) }));
  await go(page, "/v2/money");
  await expect(page.getByText("Денежный контур недоступен")).toBeVisible();
  await both(page, "money_unavailable");
  await page.unroute("**/api/money");
  let calls = 0;
  await page.route("**/api/money", async r => { calls += 1; if (calls === 1) return r.continue(); return r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, code: "provider_unavailable", message: "База недоступна" }) }); });
  await go(page, "/v2/money");
  await expect(page.getByText("Systeme Electric").first()).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText("Обновление не удалось")).toBeVisible();
  await expect(page.getByText("Systeme Electric").first()).toBeVisible();
  await both(page, "money_stale_snapshot");
});

test("supplier — stale-409, draft, sent, confirmed, 404", async ({ page }) => {
  watch(page, "supplier");
  const PO = await freshOrder(page);
  await page.route("**/api/supplier/*/reply", r => r.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ ok: false, code: "channel_not_sent", message: "channel_not_sent" }) }));
  await go(page, `/v2/supplier/${PO}`);
  await expect(page.getByText("Черновик заказа — не отправлен").first()).toBeVisible();
  await page.getByRole("button", { name: "Разместить в демо-канале" }).click();
  await expect(page.getByText("Данные обновились")).toBeVisible();
  await both(page, "supplier_stale_409");
  await page.unroute("**/api/supplier/*/reply");
  await go(page, `/v2/supplier/${PO}`);
  await expect(page.getByText("Черновик заказа — не отправлен").first()).toBeVisible();
  // keyboard: j moves focus down the rows, Enter opens the rationale
  await page.locator("[data-row]").first().focus();
  await page.keyboard.press("j"); await page.keyboard.press("Enter");
  await expect(page.locator("details[open]").first()).toBeVisible();
  await both(page, "supplier_draft");
  await page.getByRole("button", { name: "Разместить в демо-канале" }).click();
  await expect(page.getByText("Отправлено (контролируемый демо-канал)").first()).toBeVisible();
  await both(page, "supplier_sent");
  await page.getByRole("button", { name: "Подтвердить получение" }).click();
  await expect(page.getByText("Подтверждено (симулятор)").first()).toBeVisible();
  await both(page, "supplier_confirmed");
  await go(page, "/v2/supplier/PO-NOPE");
  await expect(page.getByText("Заказ не найден")).toBeVisible();
  await both(page, "supplier_404");
});

test("keyboard — slash focuses search, tab order reaches primary action", async ({ page }) => {
  watch(page, "keyboard");
  await go(page, "/v2/money");
  await page.keyboard.press("/");
  await expect(page.getByLabel("Поиск (клавиша /)")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Поиск (клавиша /)")).not.toBeFocused();
  await page.keyboard.press("/");
  await page.keyboard.type("130300027");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/v2\/skus\/130300027_/);
  await page.setViewportSize(SIZES.desktop);
  await page.getByRole("button", { name: "Скорректировать" }).focus();
  await page.screenshot({ path: `${OUT}/sku_focus_ring_desktop.png` });
});
