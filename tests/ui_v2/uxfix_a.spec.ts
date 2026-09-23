import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

// Lane UX-FIX-A: sortable replenishment columns (numeric + text, URL-persisted), basket action label,
// stake formatting, purchasing-language rationale, SKU thumbnails, calc control in the header.
const EVIDENCE = join(__dirname, "..", "..", "docs", "evidence", "v2", "uxfix_a");
mkdirSync(EVIDENCE, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: join(EVIDENCE, `${name}_1440x900.png`), fullPage: true, animations: "disabled" });
const num = (s: string) => Number(s.split("\n")[0].replace(/[^\d,-]/g, "").replace(",", "."));

test.describe("Replenishment sorting + basket", () => {
  test("cost desc is numeric, name asc is a→z, sort persists in the URL", async ({ page }) => {
    await page.goto("/replenishment?supplier=SE");
    const rows = page.locator("tr[role=button]");
    await expect(rows.first()).toBeVisible({ timeout: 20_000 });
    await expect(rows.first().locator("td").nth(7)).not.toContainText("не задана", { timeout: 15_000 });
    await page.getByRole("button", { name: /^Стоимость/ }).click();
    await expect(page).toHaveURL(/sort=cost%3Adesc|sort=cost:desc/);
    await expect(page.locator("th[aria-sort=descending]")).toHaveCount(1);
    const costs = await Promise.all([0, 1, 2, 3].map(i => rows.nth(i).locator("td").nth(7).innerText()));
    const values = costs.map(num);
    for (let i = 1; i < values.length; i++) expect(values[i - 1], `row ${i} ≥ row ${i + 1}: ${costs.join(" | ")}`).toBeGreaterThanOrEqual(values[i]);
    await page.getByRole("button", { name: /^Стоимость/ }).click();
    await expect(page).toHaveURL(/sort=cost%3Aasc|sort=cost:asc/);
    await expect(page.locator("th[aria-sort=ascending]")).toHaveCount(1);
    // reload keeps the sort
    await page.reload();
    await expect(page.locator("th[aria-sort=ascending]")).toHaveCount(1, { timeout: 20_000 });
    // text column: a→z on the first click
    await page.getByRole("button", { name: /^Позиция/ }).click();
    await expect(page).toHaveURL(/sort=name%3Aasc|sort=name:asc/);
    await expect(rows.first()).toBeVisible({ timeout: 20_000 });
    const names = await Promise.all([0, 1, 2].map(i => rows.nth(i).locator("td").nth(1).innerText().then(t => t.split("\n")[0].trim().toLowerCase())));
    expect([...names].sort((a, b) => a.localeCompare(b, "ru"))).toEqual(names);
    // keyboard: header buttons are focusable and toggle with Enter
    await page.getByRole("button", { name: /^Срочность/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/sort=urgency%3Aasc|sort=urgency:asc/);
  });

  test("basket action label + calc control + evidence screenshot (cost desc, one row expanded)", async ({ page }) => {
    await page.goto("/replenishment?supplier=SE&sort=cost:desc");
    const first = page.locator("tr[role=button]").first();
    await expect(first).toBeVisible({ timeout: 20_000 });
    await expect(first.locator("td").nth(7)).not.toContainText("не задана", { timeout: 15_000 });
    await expect(page.getByRole("button", { name: /^(Пересчитать|Рассчитать заказы)/ })).toBeVisible();
    await expect(page.getByText("Подготовить сообщение поставщику")).toBeVisible();
    await first.click();
    await expect(page.getByText("Как получилось число")).toBeVisible();
    await expect(page.getByText("Пояснение расчёта")).toBeVisible();
    await expect(page.getByText(/^Артикул \d/)).toBeVisible();
    await expect(page.locator("body")).not.toContainText("z = 1,28");
    await expect(page.locator("body")).not.toContainText("p95");
    await expect(page.getByText("Попадёт в заказ поставщику")).toBeVisible();
    const add = page.getByRole("button", { name: "Добавить в корзину" });
    await expect(add).toBeVisible();
    await expect(page.getByRole("button", { name: "В черновик" })).toHaveCount(0);
    await shot(page, "replenishment_cost_desc_expanded");
  });

  test("«Все» shows one order button per supplier with the line count", async ({ page }) => {
    await page.goto("/replenishment");
    await expect(page.locator("tr[role=button]").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /Подготовить заказ SE/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Подготовить заказ IEK/ })).toBeVisible();
    await expect(page.getByText("Выберите поставщика, чтобы подготовить заказ")).toHaveCount(0);
  });
});

test.describe("SKU index thumbnails", () => {
  test("rows carry a 28px thumbnail or a neutral placeholder", async ({ page }) => {
    await page.goto("/skus");
    const thumbs = page.locator("[data-sku-thumb]");
    await expect(thumbs.first()).toBeVisible({ timeout: 20_000 });
    expect(await page.locator("img[data-sku-thumb]").count()).toBeGreaterThan(0);
    const box = await thumbs.first().boundingBox();
    expect(box?.width).toBe(28);
    await shot(page, "skus_index");
  });
});
