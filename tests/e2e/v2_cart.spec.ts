// @ts-nocheck — same local-Playwright setup as the other e2e specs.
import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3123";
const OUT = "docs/evidence/v2/cart";
const TECHNICAL = /api\/|_review|state_version|\bJSON\b|undefined|\bnull\b|qty_adjusted|qty_recommended/;

async function settle(page, path) { await page.goto(`${BASE}${path}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(700); }

test("add to cart opens the panel with the line, totals, sort and a way to the review page", async ({ page }, info) => {
  const phone = info.project.name === "phone";
  await settle(page, "/replenishment?supplier=SE");
  const runBtn = page.getByRole("button", { name: "Запустить расчёт" });
  if (await runBtn.count()) { await runBtn.click(); await page.waitForTimeout(6000); await settle(page, "/replenishment?supplier=SE"); }

  // Header cart button is always there.
  const cartBtn = page.locator("[data-cart-button]");
  await expect(cartBtn).toBeVisible();
  await expect(cartBtn).toContainText("Корзина");

  // Open the first row, change the quantity, add to cart.
  const firstRow = page.locator("tbody tr").first();
  await firstRow.click();
  const qtyInput = page.locator("tr[id^='x-'] input[type='number']").first();
  await expect(qtyInput).toBeVisible();
  const before = Number(await qtyInput.inputValue());
  await qtyInput.fill(String(before + 5));
  await page.getByRole("button", { name: "Добавить в корзину" }).first().click();

  const panel = page.locator("[data-cart-panel]");
  await expect(panel).toBeVisible();
  await expect(panel.locator("[data-cart-totals]").first()).toBeVisible();
  await expect(panel.locator("[data-cart-line]").first()).toBeVisible();
  await expect(panel.getByText("изменено вами").first()).toBeVisible();
  await expect(panel.getByText("Предоплата", { exact: false }).first()).toBeVisible();
  await expect(cartBtn.locator("[data-cart-count]")).toContainText(/позици/);
  const text = await panel.innerText();
  const hit = text.match(TECHNICAL);
  expect(hit, `technical term «${hit?.[0]}» in the cart`).toBeNull();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/cart_${phone ? "phone" : "desktop"}.png` });

  // Totals, prepayment split, lead time and insights sit above the SE lines.
  const seTotals = panel.locator("[data-cart-supplier='SE'] [data-cart-totals]");
  await seTotals.scrollIntoViewIfNeeded();
  await expect(seTotals).toContainText("Поставка");
  await page.screenshot({ path: `${OUT}/cart_totals_${phone ? "phone" : "desktop"}.png` });

  // Sort toggles.
  await panel.getByRole("button", { name: "по сумме" }).click();
  await expect(panel.getByRole("button", { name: "по сумме" })).toHaveAttribute("aria-pressed", "true");
  await panel.getByRole("button", { name: "по срочности" }).click();
  await expect(panel.getByRole("button", { name: "по срочности" })).toHaveAttribute("aria-pressed", "true");

  // Escape closes without leaving the page; the cart button reopens.
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await cartBtn.click();
  await expect(panel).toBeVisible();

  // Prepare the order → review page.
  const prepare = panel.locator("[data-cart-prepare]").first();
  await expect(prepare).toBeVisible();
  await prepare.click();
  await page.waitForURL(/\/review\/[^/]+$/);
  await page.waitForLoadState("networkidle");
  expect(page.url()).toMatch(/\/review\//);
  await page.screenshot({ path: `${OUT}/cart_review_${phone ? "phone" : "desktop"}.png` });
});
