import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";

const BASE = process.env.OPUS_A_URL ?? "http://localhost:3111";
const OUT = "docs/evidence/opus_a/astra";
const SKU = "130200122_";
const views = [{ name: "desktop", width: 1440, height: 900 }, { name: "phone", width: 390, height: 844 }];
async function ready(page: Page) { await expect(page.locator(".oa-skel")).toHaveCount(0, { timeout: 20_000 }); await page.evaluate(() => document.fonts.ready); }
async function shot(page: Page, name: string, fullPage = false) {
  await page.locator('img').evaluateAll(images => Promise.race([Promise.all(images.map(image => { (image as HTMLImageElement).loading = 'eager'; return (image as HTMLImageElement).decode().catch(() => {}); })), new Promise(resolve => setTimeout(resolve, 2000))]));
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const overflowing = await page.locator('.oa-table,.oa-rail,.oa-tabs').evaluateAll(nodes => nodes.filter(node => node.scrollWidth > node.clientWidth + 2).map(node => node.className));
  expect(overflowing).toEqual([]);
}
async function openFirstRow(page: Page) {
  const row = page.locator('[data-row-toggle]').first();
  if (await row.getAttribute('aria-expanded') !== 'true') await row.click();
  await expect(page.locator('.oa-why')).toBeVisible();
}

test.describe.configure({ mode: 'default' });
for (const viewport of views) {
  test(`${viewport.name}: three populated screens, reflow and rationale`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize(viewport);
    for (const [name, path] of [['today', 'today'], ['replenishment', 'replenishment?supplier=SE'], ['sku', `skus/${SKU}`]]) {
      await page.goto(`${BASE}/opus_a/${path}`); await ready(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (viewport.name === 'phone') await noOverflow(page);
      await shot(page, `after-${name}-${viewport.name}`);
      await shot(page, `after-${name}-${viewport.name}-full`, true);
      if (name === 'replenishment') {
        await openFirstRow(page);
        await page.locator('.oa-why').scrollIntoViewIfNeeded();
        await shot(page, `rationale-${viewport.name}`);
        if (viewport.name === 'phone') await noOverflow(page);
        await expect(page.getByText('Изменение количества пока недоступно')).toBeVisible();
        await shot(page, `adjust-unavailable-${viewport.name}`);
      }
    }
    expect(errors).toEqual([]);
  });
}

test('search: code, article, name; keyboard, empty and unavailable', async ({ page }) => {
  await page.goto(`${BASE}/opus_a/today`); await ready(page);
  const search = page.getByRole('combobox', { name: 'Поиск товара' });
  for (const term of [SKU, 'YNN10-812-10DP-K07', 'Шина']) {
    await page.keyboard.press('Meta+k'); await expect(search).toBeFocused();
    await search.fill(term); await expect(page.getByRole('option').first()).toBeVisible();
    await expect(page.locator('.oa-results')).toContainText(term === 'Шина' ? 'Шина' : SKU);
  }
  await page.keyboard.press('ArrowDown'); await expect(page.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
  await shot(page, 'search-results-desktop');
  await page.keyboard.press('Escape'); await expect(search).toBeFocused(); await expect(page.getByRole('listbox')).toHaveCount(0);
  await page.keyboard.press('Meta+k'); await search.fill(SKU); await expect(page.getByRole('option')).toHaveCount(1); await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/opus_a/skus/${SKU}`)); await ready(page);
  await page.keyboard.press('Meta+k'); await search.fill('zz-no-such-code'); await expect(page.getByText(/ничего не найдено/)).toBeVisible(); await shot(page, 'search-empty-desktop');
  await page.route('**/api/skus?**', route => route.fulfill({ status: 503, json: { ok: false, message: 'Недоступно' } }));
  await search.fill('1302'); await expect(page.getByText('Поиск недоступен.')).toBeVisible(); await shot(page, 'search-unavailable-desktop');
  await page.unroute('**/api/skus?**'); await page.getByRole('button', { name: 'Повторить', exact: true }).click(); await expect(page.getByRole('option').first()).toBeVisible();
});

test('row and tab keys; filter, disclosure and scroll survive SKU return', async ({ page }) => {
  await page.goto(`${BASE}/opus_a/replenishment?supplier=SE`); await ready(page);
  const tab = page.getByRole('tab', { name: /^Все / }); await tab.focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /^Критично / })).toBeFocused();
  const filter = page.getByRole('textbox', { name: 'Фильтр по названию или коду 1С' }); await filter.fill('030200');
  const rows = page.locator('[data-row-toggle]'); await rows.first().focus(); await page.keyboard.press('j'); await expect(rows.nth(1)).toBeFocused();
  await page.keyboard.press('k'); await expect(rows.first()).toBeFocused(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(page.locator('.oa-why')).toBeVisible();
  await page.getByRole('link', { name: 'Карточка товара', exact: true }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(80); const scroll = await page.evaluate(() => window.scrollY);
  await page.getByRole('link', { name: 'Карточка товара', exact: true }).click(); await ready(page);
  await page.locator('.oa-crumb a').click(); await ready(page);
  await expect(filter).toHaveValue('030200'); await expect(page.getByRole('tab', { name: /^Критично / })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.oa-why')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(scroll, -1);
  await rows.nth(1).focus(); await page.keyboard.press('Escape'); await expect(page.locator('.oa-why')).toHaveCount(0);
  await filter.fill('nothing-found'); await expect(page.getByText('По этому фильтру товаров нет')).toBeVisible(); await shot(page, 'replenishment-filter-empty');
  await page.getByRole('button', { name: 'Сбросить фильтр' }).click(); await expect(filter).toHaveValue(''); await expect(rows.first()).toBeVisible();
});

test('adjust contract: freeze version, 409 blocks resubmit, refresh keeps draft, success', async ({ page, request }) => {
  const detail = await (await request.get(`${BASE}/api/skus/${SKU}`)).json();
  const rec = detail.recommendation; let sent: Record<string, unknown> | undefined; let calls = 0;
  await page.route('**/api/recommendations/*/adjust', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
    sent = route.request().postDataJSON(); calls++;
    return route.fulfill({ status: calls === 1 ? 409 : 200, json: calls === 1 ? { ok: false, code: 'stale', message: 'stale' } : { ok: true } });
  });
  await page.goto(`${BASE}/opus_a/replenishment?supplier=IEK&code=${SKU}`); await ready(page); await openFirstRow(page);
  await page.getByRole('button', { name: 'Изменить количество', exact: true }).click();
  const value = page.getByLabel('Количество, шт', { exact: true }); const reason = page.getByLabel('Причина (обязательно)');
  await expect(value).toBeFocused(); await value.fill('460'); await reason.fill('Клиент подтвердил объём');
  await page.route(`**/api/skus/${SKU}`, route => route.fulfill({ json: { ...detail, recommendation: { ...rec, version: rec.version + 1 } } }));
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click(); await expect(page.getByText('Данные обновились', { exact: true })).toBeVisible();
  expect(sent).toEqual({ qty: 460, reason: 'Клиент подтвердил объём', version: rec.version });
  await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled(); await shot(page, 'adjust-stale-contract');
  await page.getByRole('button', { name: 'Обновить', exact: true }).click(); await expect(value).toHaveValue('460'); await expect(reason).toHaveValue('Клиент подтвердил объём');
  await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeEnabled(); await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Сохранено: 460 шт')).toBeVisible(); expect(sent?.version).toBe(rec.version + 1); expect(calls).toBe(2); await shot(page, 'adjust-saved-contract');
});

for (const viewport of views) {
  test(`${viewport.name}: proposal 409, no stale repeat, keyboard escape`, async ({ page }) => {
    await page.setViewportSize(viewport); let version: number | undefined;
    await page.route('**/api/proposals/*/approve', route => { version = route.request().postDataJSON().proposal_version; return route.fulfill({ status: 409, json: { ok: false, code: 'stale', message: 'stale' } }); });
    await page.goto(`${BASE}/opus_a/today`); await ready(page);
    const opener = page.getByRole('button', { name: 'Решить…' }).first(); await opener.focus(); await page.keyboard.press('Enter');
    const confirm = page.getByRole('button', { name: 'Подготовить заказ' }); await expect(confirm).toBeFocused(); await shot(page, `proposal-confirm-${viewport.name}`);
    await page.keyboard.press('Enter'); await expect(page.getByText('Данные обновились', { exact: true })).toBeVisible(); await expect(confirm).toBeDisabled(); expect(version).toBeGreaterThan(0);
    await shot(page, `proposal-stale-${viewport.name}`); if (viewport.name === 'phone') await noOverflow(page);
    await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Решить…' }).first()).toBeFocused();
  });
}

test('empty, unavailable, loading, missing SKU and optional EKT states', async ({ page, request }) => {
  await page.route('**/api/queue', route => route.fulfill({ json: { ok: true, items: [] } }));
  await page.goto(`${BASE}/opus_a/today`); await ready(page); await expect(page.getByText('Решений нет')).toBeVisible(); await shot(page, 'today-empty');
  await page.unroute('**/api/queue');
  for (const [name, api, path] of [['today', '**/api/today', 'today'], ['replenishment', '**/api/recommendations**', 'replenishment'], ['sku', `**/api/skus/${SKU}`, `skus/${SKU}`]]) {
    await page.route(api, route => route.fulfill({ status: 503, json: { ok: false, message: 'Не удалось получить данные. Повторите попытку.' } }));
    await page.goto(`${BASE}/opus_a/${path}`); await expect(page.getByText('Данные недоступны').first()).toBeVisible(); await shot(page, `${name}-unavailable`); await page.unroute(api);
  }
  await page.route('**/api/recommendations**', async route => { await new Promise(resolve => setTimeout(resolve, 1200)); await route.continue(); });
  await page.goto(`${BASE}/opus_a/replenishment`); await expect(page.locator('.oa-skel').first()).toBeVisible(); await shot(page, 'replenishment-loading'); await ready(page); await page.unroute('**/api/recommendations**');
  await page.setViewportSize(views[1]); await page.goto(`${BASE}/opus_a/skus/000000000_`); await expect(page.getByText('Товар не найден')).toBeVisible(); await expect(page.locator('.oa-skel')).toHaveCount(0); await shot(page, 'sku-not-found-phone'); await noOverflow(page);
  const detail = await (await request.get(`${BASE}/api/skus/${SKU}`)).json();
  await page.route(`**/api/skus/${SKU}`, route => route.fulfill({ json: { ...detail, ekt: { price: '123.45', currency: 'KZT', stock_total: 400, as_of: '2026-09-22T10:00:00Z', source: 'ekt_api_snapshot' } } }));
  await page.goto(`${BASE}/opus_a/skus/${SKU}`); await ready(page); await page.getByRole('heading', { name: 'Каталог ЭКТ' }).scrollIntoViewIfNeeded(); await expect(page.locator('.oa-ekt')).toContainText('123,45'); await shot(page, 'sku-ekt-contract-phone'); await noOverflow(page);
});

test('320px, touch targets, visible focus and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const path of ['today', 'replenishment?supplier=SE', `skus/${SKU}`]) {
    await page.goto(`${BASE}/opus_a/${path}`); await ready(page); await noOverflow(page);
    const small = await page.locator('.oa-btn,.oa-nav a,.oa-tabs button,.oa-seg a,.oa-search label').evaluateAll(nodes => nodes.filter(node => node.getBoundingClientRect().height < 44 && node.getBoundingClientRect().width > 0).map(node => ({ text: node.textContent, height: node.getBoundingClientRect().height })));
    expect(small).toEqual([]);
  }
  await page.getByRole('combobox').focus(); expect(await page.getByRole('combobox').evaluate(node => getComputedStyle(node.closest('label')!).boxShadow)).not.toBe('none');
  await page.goto(`${BASE}/opus_a/replenishment?supplier=SE`); await ready(page); await page.locator('[data-row-toggle]').first().focus();
  expect(await page.locator('[data-row-toggle]').first().evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid'); await shot(page, 'focus-phone-320');
});

test('real recalculation: complete run, busy state and history', async ({ page, request }) => {
  await page.goto(`${BASE}/opus_a/replenishment?supplier=SE`); await ready(page);
  const previous = await (await request.get(`${BASE}/api/calc/runs`)).json();
  const response = page.waitForResponse(response => response.url().endsWith('/api/calc/run') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Пересчитать всё' }).click();
  await expect(page.getByRole('button', { name: 'Считаю…' })).toBeDisabled();
  expect((await response).ok()).toBe(true); await expect(page.getByText(/Расчёт готов:/)).toBeVisible();
  const current = await (await request.get(`${BASE}/api/calc/runs`)).json(); expect(current.runs[0].id).not.toBe(previous.runs[0].id); expect(current.runs[0].scope.supplier).toBeUndefined(); expect(current.runs[0].scope.codes.length).toBeGreaterThan(1000);
  const recommendations = await (await request.get(`${BASE}/api/recommendations`)).json(); expect(recommendations.groups.map((group: { supplier_id: string }) => group.supplier_id).sort()).toEqual(['IEK', 'SE']);
  await page.locator('.oa-run-history summary').click(); await expect(page.locator('.oa-run-history li').first()).toContainText('Все поставщики'); await shot(page, 'run-history-desktop');
});

test('real local order: prepare, approve exact version, download CSV/XLSX with Код 1с', async ({ page }) => {
  await page.goto(`${BASE}/opus_a/today`); await ready(page);
  await page.getByRole('button', { name: 'Решить…' }).first().click();
  const prepared = page.waitForResponse(response => /\/api\/proposals\/[^/]+\/approve$/.test(response.url()) && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Подготовить заказ' }).click();
  const result = await (await prepared).json();
  const order = page.locator(`[id="order-${result.po_id}"]`); await expect(order).toBeVisible();
  await order.getByRole('button', { name: 'Проверить и утвердить' }).click();
  const approved = page.waitForResponse(response => response.url().endsWith(`/api/orders/${result.po_id}/approve`));
  await order.getByRole('button', { name: 'Утвердить заказ', exact: true }).click(); expect((await approved).ok()).toBe(true); await expect(order.getByText('Утверждён', { exact: true })).toBeVisible();
  await order.scrollIntoViewIfNeeded(); await shot(page, 'approved-order-desktop');
  for (const format of ['CSV', 'XLSX']) {
    const downloaded = page.waitForEvent('download'); await order.getByRole('link', { name: format, exact: true }).click(); const download = await downloaded;
    const file = await download.path(); expect(file).not.toBeNull(); const buffer = await readFile(file!);
    if (format === 'CSV') { expect(buffer.toString('utf8')).toContain('Код 1с'); expect(buffer.toString('utf8')).toMatch(/\d{9}_/); }
    else { const workbook = XLSX.read(buffer); const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }); expect(JSON.stringify(rows)).toContain('Код 1с'); expect(JSON.stringify(rows)).toMatch(/\d{9}_/); }
  }
  await page.setViewportSize(views[1]); await order.scrollIntoViewIfNeeded(); await shot(page, 'approved-order-phone'); await noOverflow(page);
});

for (const viewport of views) {
  test(`${viewport.name}: loading, empty and unavailable state matrix`, async ({ page, request }) => {
    test.setTimeout(90_000); await page.setViewportSize(viewport);
    for (const [name, api, path] of [['today', '**/api/today', 'today'], ['replenishment', '**/api/recommendations**', 'replenishment'], ['sku', `**/api/skus/${SKU}`, `skus/${SKU}`]]) {
      let release!: () => void; const blocked = new Promise<void>(resolve => { release = resolve; });
      await page.route(api, async route => { await blocked; await route.continue(); });
      await page.goto(`${BASE}/opus_a/${path}`); await expect(page.locator('.oa-skel').first()).toBeVisible();
      await page.screenshot({ path: `${OUT}/${name}-loading-${viewport.name}.png` }); release(); await ready(page); await page.unroute(api);
      await page.route(api, route => route.fulfill({ status: 503, json: { ok: false, message: 'Не удалось получить данные. Повторите попытку.' } }));
      await page.reload(); await expect(page.getByText('Данные недоступны').first()).toBeVisible(); await shot(page, `${name}-unavailable-${viewport.name}`); await noOverflow(page); await page.unroute(api);
    }
    await page.route('**/api/recommendations**', route => route.fulfill({ json: { ok: true, groups: [], state_version: 1 } }));
    await page.goto(`${BASE}/opus_a/replenishment`); await ready(page); await expect(page.getByText('Рекомендаций нет')).toBeVisible(); await shot(page, `replenishment-empty-${viewport.name}`); await page.unroute('**/api/recommendations**');
    const detail = await (await request.get(`${BASE}/api/skus/${SKU}`)).json();
    await page.route(`**/api/skus/${SKU}`, route => route.fulfill({ json: { ...detail, recommendation: null, sku: { ...detail.sku, image_url: null } } }));
    await page.goto(`${BASE}/opus_a/skus/${SKU}`); await ready(page); await expect(page.locator('.oa-sku-title img')).toHaveCount(0); await page.locator('#oa-rec').scrollIntoViewIfNeeded(); await shot(page, `sku-no-recommendation-${viewport.name}`); await noOverflow(page);
  });
}

test('order conflict binds reviewed version and cannot silently repeat approval', async ({ page, request }) => {
  const data = await (await request.get(`${BASE}/api/orders`)).json();
  const draft = { ...data.orders[0], state: 'draft', version: 7 }; let calls = 0;
  await page.route('**/api/orders', route => route.fulfill({ json: { ok: true, orders: [draft] } }));
  await page.route(`**/api/orders/${draft.id}/approve`, route => { calls++; expect(route.request().postDataJSON()).toEqual({ version: 7 }); return route.fulfill({ status: 409, json: { ok: false, code: 'stale_order_version', message: 'stale' } }); });
  await page.goto(`${BASE}/opus_a/today`); await ready(page); const order = page.locator('.oa-order');
  const opener = order.getByRole('button', { name: 'Проверить и утвердить' }); await opener.click(); await page.keyboard.press('Escape'); await expect(opener).toBeFocused(); await opener.click();
  const confirm = order.getByRole('button', { name: 'Утвердить заказ', exact: true }); await confirm.click(); await expect(order.getByText('Данные обновились')).toBeVisible(); await expect(confirm).toBeDisabled(); expect(calls).toBe(1); await shot(page, 'order-stale-desktop');
});
