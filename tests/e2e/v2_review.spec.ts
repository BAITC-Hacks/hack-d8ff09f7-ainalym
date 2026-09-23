// @ts-nocheck — same local-Playwright setup as the other e2e specs.
import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3131";
const OUT = "docs/evidence/v2/reviewfix";
const FORBIDDEN = ["PR-", "REC-", "qty", "state_version", "JSON", "HTTP", "undefined", "null", "proposal_version"];

async function firstProposalHref(page) {
  await page.goto(`${BASE}/today`);
  await page.waitForLoadState("networkidle"); await page.waitForTimeout(600);
  const queue = await (await page.request.get(`${BASE}/api/queue`)).json();
  const proposals = queue.items.filter((i) => i.kind === "proposal");
  const item = proposals.find((i) => i.money_at_stake) ?? proposals[0];
  expect(item, "queue has a proposal").toBeTruthy();
  const link = page.locator(`a[href="/review/${item.id}"]`).first();
  if (await link.count()) return { href: await link.getAttribute("href"), priced: !!item.money_at_stake };
  return { href: item.href ?? `/review/${encodeURIComponent(item.id)}`, priced: !!item.money_at_stake };
}

test("review — Fable language, no ids, approve → receipt (1440×900)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { href, priced } = await firstProposalHref(page);
  await page.goto(`${BASE}${href}`);
  await page.waitForLoadState("networkidle"); await page.waitForTimeout(800);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Заказ поставщику");
  await expect(page.getByRole("heading", { name: "Основание" })).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Изменить количество" })).toBeVisible();
  const before = await page.locator("body").innerText();
  for (const term of FORBIDDEN) expect(before, `no technical term «${term}»`).not.toContain(term);
  if (priced) expect(before).toMatch(/₸/);
  await page.screenshot({ path: `${OUT}/review_desktop.png` });
  await page.screenshot({ path: `${OUT}/review_desktop_full.png`, fullPage: true });
  // sort toggles work without technical text
  await page.getByRole("button", { name: "по стоимости" }).click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "Утвердить заказ" }).click();
  await expect(page.getByRole("status", { name: "Итог решения" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("status", { name: "Итог решения" })).toContainText("Утверждено");
  if (priced) await expect(page.getByRole("status", { name: "Итог решения" })).toContainText("Предоплата 30 %");
  const receipt = page.getByRole("status", { name: "Итог решения" });
  await expect(receipt.getByRole("link", { name: "Деньги" })).toBeVisible();
  await expect(receipt.getByRole("link", { name: "Заказы" })).toBeVisible();
  await expect(receipt.getByRole("link", { name: /Выгрузка для 1С/ })).toBeVisible();
  const after = await page.locator("body").innerText();
  for (const term of FORBIDDEN) expect(after, `no technical term «${term}» after approval`).not.toContain(term);
  await page.screenshot({ path: `${OUT}/review_desktop_approved.png` });
});

test("review — 390×844 without horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { href } = await firstProposalHref(page);
  await page.goto(`${BASE}${href}`);
  await page.waitForLoadState("networkidle"); await page.waitForTimeout(800);
  await expect(page.getByRole("heading", { name: "Основание" })).toBeVisible();
  const body = await page.locator("body").innerText();
  for (const term of FORBIDDEN) expect(body, `no technical term «${term}»`).not.toContain(term);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "no horizontal scroll at 390px").toBeLessThanOrEqual(0);
  await page.screenshot({ path: `${OUT}/review_phone.png` });
  await page.screenshot({ path: `${OUT}/review_phone_full.png`, fullPage: true });
});
