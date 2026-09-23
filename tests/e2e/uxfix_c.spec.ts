// @ts-nocheck — same local-Playwright setup as the other e2e specs.
import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3123";
const OUT = "docs/evidence/v2/uxfix_c";
const ROUTES = ["/today", "/replenishment", "/orders", "/suppliers", "/skus", "/skus/010300008_", "/money", "/world", "/connections", "/assistant"];
// Owner law: nothing technical reaches a purchasing manager's screen.
const TECHNICAL = /api\/|_review|purchasing_manager|\bETA\b|\bp95\b|obligation\.|\.qty|state_version|\bJSON\b|ready_to_handover|supplier_reply|order_drafted|purchase_order_line|ledger_peer_record/;

async function settle(page, path) { await page.goto(`${BASE}${path}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(700); }

test("no technical terms on Today, SKU card, Orders, Feed (1440×900)", async ({ page }) => {
  for (const path of ["/today", "/skus/010300008_", "/orders", "/world"]) {
    await settle(page, path);
    const body = await page.locator("body").innerText();
    const hit = body.match(TECHNICAL);
    expect(hit, `${path}: technical term «${hit?.[0]}» visible`).toBeNull();
  }
});

test("feed empty state offers demo events and rows read in purchasing language", async ({ page }) => {
  await settle(page, "/world");
  const rows = page.locator("ol li h3");
  if (await rows.count() === 0) {
    await page.getByRole("button", { name: "Показать демо-события" }).click();
    await page.waitForTimeout(2500);
  }
  expect(await rows.count()).toBeGreaterThan(0);
  for (const text of await rows.allInnerTexts()) expect(text, "event kind is a label, not an enum").not.toMatch(/^[a-z_]+$/);
});

test("1С export downloads behind the same origin; empty order shows a plain error", async ({ page }) => {
  await settle(page, "/orders/PO-uxfixc-local-approved");
  const exportButton = page.locator('button[data-export="xlsx"]').first();
  if (!(await exportButton.count())) { test.skip(true, "no local approved order seeded"); return; }
  const [download] = await Promise.all([page.waitForEvent("download"), exportButton.click()]);
  expect(download.suggestedFilename()).toMatch(/^Заказ_поставщику_SE_\d{4}-\d{2}-\d{2}\.xlsx$/);
  await settle(page, "/orders/PO-uxfixc-local-empty");
  const empty = page.locator('button[data-export="xlsx"]').first();
  if (await empty.count()) { await empty.click(); await expect(page.getByRole("alert").first()).toContainText("нет строк"); }
});

test("phone 390×844: no horizontal scroll on the routes this lane owns or shares", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ROUTES.filter(r => r !== "/replenishment")) {
    await settle(page, path);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width, `${path} scrollWidth`).toBeLessThanOrEqual(390);
    if (path === "/today" || path === "/world") await page.screenshot({ path: `${OUT}/${path.slice(1)}_phone.png` });
  }
});

// Known: the filter chips row in the replenishment stylesheet (owned by the replenishment lane) widens the page to ~411 px.
// Marked as an expected failure so it flips to "unexpected pass" the moment that lane adds min-width: 0 / overflow-x: auto to the chips row.
test("phone 390×844: /replenishment (other lane) — expected to overflow until its chips row wraps or scrolls", async ({ page }) => {
  test.fail(true, "replenishment chips row overflows; fix belongs to the replenishment lane");
  await page.setViewportSize({ width: 390, height: 844 });
  await settle(page, "/replenishment");
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  test.info().annotations.push({ type: "measured", description: `scrollWidth=${width}` });
  expect(width, "/replenishment scrollWidth").toBeLessThanOrEqual(390);
});

test("desktop screenshots of Today and Feed", async ({ page }) => {
  for (const path of ["/today", "/world"]) { await settle(page, path); await page.screenshot({ path: `${OUT}/${path.slice(1)}_desktop.png` }); }
});
