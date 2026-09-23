# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: opus_a.spec.ts >> phone: loading, empty and unavailable state matrix
- Location: tests/e2e/opus_a.spec.ts:183:7

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - navigating to "http://localhost:3111/opus_a/skus/130200122_", waiting until "load"

```

# Test source

```ts
  88  | 
  89  | test('adjust contract: freeze version, 409 blocks resubmit, refresh keeps draft, success', async ({ page, request }) => {
  90  |   const detail = await (await request.get(`${BASE}/api/skus/${SKU}`)).json();
  91  |   const rec = detail.recommendation; let sent: Record<string, unknown> | undefined; let calls = 0;
  92  |   await page.route('**/api/recommendations/*/adjust', async route => {
  93  |     if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
  94  |     sent = route.request().postDataJSON(); calls++;
  95  |     return route.fulfill({ status: calls === 1 ? 409 : 200, json: calls === 1 ? { ok: false, code: 'stale', message: 'stale' } : { ok: true } });
  96  |   });
  97  |   await page.goto(`${BASE}/opus_a/replenishment?supplier=IEK&code=${SKU}`); await ready(page); await openFirstRow(page);
  98  |   await page.getByRole('button', { name: 'Изменить количество', exact: true }).click();
  99  |   const value = page.getByLabel('Количество, шт', { exact: true }); const reason = page.getByLabel('Причина (обязательно)');
  100 |   await expect(value).toBeFocused(); await value.fill('460'); await reason.fill('Клиент подтвердил объём');
  101 |   await page.route(`**/api/skus/${SKU}`, route => route.fulfill({ json: { ...detail, recommendation: { ...rec, version: rec.version + 1 } } }));
  102 |   await page.getByRole('button', { name: 'Сохранить', exact: true }).click(); await expect(page.getByText('Данные обновились', { exact: true })).toBeVisible();
  103 |   expect(sent).toEqual({ qty: 460, reason: 'Клиент подтвердил объём', version: rec.version });
  104 |   await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled(); await shot(page, 'adjust-stale-contract');
  105 |   await page.getByRole('button', { name: 'Обновить', exact: true }).click(); await expect(value).toHaveValue('460'); await expect(reason).toHaveValue('Клиент подтвердил объём');
  106 |   await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeEnabled(); await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  107 |   await expect(page.getByText('Сохранено: 460 шт')).toBeVisible(); expect(sent?.version).toBe(rec.version + 1); expect(calls).toBe(2); await shot(page, 'adjust-saved-contract');
  108 | });
  109 | 
  110 | for (const viewport of views) {
  111 |   test(`${viewport.name}: proposal 409, no stale repeat, keyboard escape`, async ({ page }) => {
  112 |     await page.setViewportSize(viewport); let version: number | undefined;
  113 |     await page.route('**/api/proposals/*/approve', route => { version = route.request().postDataJSON().proposal_version; return route.fulfill({ status: 409, json: { ok: false, code: 'stale', message: 'stale' } }); });
  114 |     await page.goto(`${BASE}/opus_a/today`); await ready(page);
  115 |     const opener = page.getByRole('button', { name: 'Решить…' }).first(); await opener.focus(); await page.keyboard.press('Enter');
  116 |     const confirm = page.getByRole('button', { name: 'Подготовить заказ' }); await expect(confirm).toBeFocused(); await shot(page, `proposal-confirm-${viewport.name}`);
  117 |     await page.keyboard.press('Enter'); await expect(page.getByText('Данные обновились', { exact: true })).toBeVisible(); await expect(confirm).toBeDisabled(); expect(version).toBeGreaterThan(0);
  118 |     await shot(page, `proposal-stale-${viewport.name}`); if (viewport.name === 'phone') await noOverflow(page);
  119 |     await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Решить…' }).first()).toBeFocused();
  120 |   });
  121 | }
  122 | 
  123 | test('empty, unavailable, loading, missing SKU and optional EKT states', async ({ page, request }) => {
  124 |   await page.route('**/api/queue', route => route.fulfill({ json: { ok: true, items: [] } }));
  125 |   await page.goto(`${BASE}/opus_a/today`); await ready(page); await expect(page.getByText('Решений нет')).toBeVisible(); await shot(page, 'today-empty');
  126 |   await page.unroute('**/api/queue');
  127 |   for (const [name, api, path] of [['today', '**/api/today', 'today'], ['replenishment', '**/api/recommendations**', 'replenishment'], ['sku', `**/api/skus/${SKU}`, `skus/${SKU}`]]) {
  128 |     await page.route(api, route => route.fulfill({ status: 503, json: { ok: false, message: 'Не удалось получить данные. Повторите попытку.' } }));
  129 |     await page.goto(`${BASE}/opus_a/${path}`); await expect(page.getByText('Данные недоступны').first()).toBeVisible(); await shot(page, `${name}-unavailable`); await page.unroute(api);
  130 |   }
  131 |   await page.route('**/api/recommendations**', async route => { await new Promise(resolve => setTimeout(resolve, 1200)); await route.continue(); });
  132 |   await page.goto(`${BASE}/opus_a/replenishment`); await expect(page.locator('.oa-skel').first()).toBeVisible(); await shot(page, 'replenishment-loading'); await ready(page); await page.unroute('**/api/recommendations**');
  133 |   await page.setViewportSize(views[1]); await page.goto(`${BASE}/opus_a/skus/000000000_`); await expect(page.getByText('Товар не найден')).toBeVisible(); await expect(page.locator('.oa-skel')).toHaveCount(0); await shot(page, 'sku-not-found-phone'); await noOverflow(page);
  134 |   const detail = await (await request.get(`${BASE}/api/skus/${SKU}`)).json();
  135 |   await page.route(`**/api/skus/${SKU}`, route => route.fulfill({ json: { ...detail, ekt: { price: '123.45', currency: 'KZT', stock_total: 400, as_of: '2026-09-22T10:00:00Z', source: 'ekt_api_snapshot' } } }));
  136 |   await page.goto(`${BASE}/opus_a/skus/${SKU}`); await ready(page); await page.getByRole('heading', { name: 'Каталог ЭКТ' }).scrollIntoViewIfNeeded(); await expect(page.locator('.oa-ekt')).toContainText('123,45'); await shot(page, 'sku-ekt-contract-phone'); await noOverflow(page);
  137 | });
  138 | 
  139 | test('320px, touch targets, visible focus and reduced motion', async ({ page }) => {
  140 |   await page.setViewportSize({ width: 320, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  141 |   for (const path of ['today', 'replenishment?supplier=SE', `skus/${SKU}`]) {
  142 |     await page.goto(`${BASE}/opus_a/${path}`); await ready(page); await noOverflow(page);
  143 |     const small = await page.locator('.oa-btn,.oa-nav a,.oa-tabs button,.oa-seg a,.oa-search label').evaluateAll(nodes => nodes.filter(node => node.getBoundingClientRect().height < 44 && node.getBoundingClientRect().width > 0).map(node => ({ text: node.textContent, height: node.getBoundingClientRect().height })));
  144 |     expect(small).toEqual([]);
  145 |   }
  146 |   await page.getByRole('combobox').focus(); expect(await page.getByRole('combobox').evaluate(node => getComputedStyle(node.closest('label')!).boxShadow)).not.toBe('none');
  147 |   await page.goto(`${BASE}/opus_a/replenishment?supplier=SE`); await ready(page); await page.locator('[data-row-toggle]').first().focus();
  148 |   expect(await page.locator('[data-row-toggle]').first().evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid'); await shot(page, 'focus-phone-320');
  149 | });
  150 | 
  151 | test('real recalculation: complete run, busy state and history', async ({ page, request }) => {
  152 |   await page.goto(`${BASE}/opus_a/replenishment?supplier=SE`); await ready(page);
  153 |   const previous = await (await request.get(`${BASE}/api/calc/runs`)).json();
  154 |   const response = page.waitForResponse(response => response.url().endsWith('/api/calc/run') && response.request().method() === 'POST');
  155 |   await page.getByRole('button', { name: 'Пересчитать всё' }).click();
  156 |   await expect(page.getByRole('button', { name: 'Считаю…' })).toBeDisabled();
  157 |   expect((await response).ok()).toBe(true); await expect(page.getByText(/Расчёт готов:/)).toBeVisible();
  158 |   const current = await (await request.get(`${BASE}/api/calc/runs`)).json(); expect(current.runs[0].id).not.toBe(previous.runs[0].id); expect(current.runs[0].scope.supplier).toBeUndefined(); expect(current.runs[0].scope.codes.length).toBeGreaterThan(1000);
  159 |   const recommendations = await (await request.get(`${BASE}/api/recommendations`)).json(); expect(recommendations.groups.map((group: { supplier_id: string }) => group.supplier_id).sort()).toEqual(['IEK', 'SE']);
  160 |   await page.locator('.oa-run-history summary').click(); await expect(page.locator('.oa-run-history li').first()).toContainText('Все поставщики'); await shot(page, 'run-history-desktop');
  161 | });
  162 | 
  163 | test('real local order: prepare, approve exact version, download CSV/XLSX with Код 1с', async ({ page }) => {
  164 |   await page.goto(`${BASE}/opus_a/today`); await ready(page);
  165 |   await page.getByRole('button', { name: 'Решить…' }).first().click();
  166 |   const prepared = page.waitForResponse(response => /\/api\/proposals\/[^/]+\/approve$/.test(response.url()) && response.request().method() === 'POST');
  167 |   await page.getByRole('button', { name: 'Подготовить заказ' }).click();
  168 |   const result = await (await prepared).json();
  169 |   const order = page.locator(`[id="order-${result.po_id}"]`); await expect(order).toBeVisible();
  170 |   await order.getByRole('button', { name: 'Проверить и утвердить' }).click();
  171 |   const approved = page.waitForResponse(response => response.url().endsWith(`/api/orders/${result.po_id}/approve`));
  172 |   await order.getByRole('button', { name: 'Утвердить заказ', exact: true }).click(); expect((await approved).ok()).toBe(true); await expect(order.getByText('Утверждён', { exact: true })).toBeVisible();
  173 |   await order.scrollIntoViewIfNeeded(); await shot(page, 'approved-order-desktop');
  174 |   for (const format of ['CSV', 'XLSX']) {
  175 |     const downloaded = page.waitForEvent('download'); await order.getByRole('link', { name: format, exact: true }).click(); const download = await downloaded;
  176 |     const file = await download.path(); expect(file).not.toBeNull(); const buffer = await readFile(file!);
  177 |     if (format === 'CSV') { expect(buffer.toString('utf8')).toContain('Код 1с'); expect(buffer.toString('utf8')).toMatch(/\d{9}_/); }
  178 |     else { const workbook = XLSX.read(buffer); const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }); expect(JSON.stringify(rows)).toContain('Код 1с'); expect(JSON.stringify(rows)).toMatch(/\d{9}_/); }
  179 |   }
  180 |   await page.setViewportSize(views[1]); await order.scrollIntoViewIfNeeded(); await shot(page, 'approved-order-phone'); await noOverflow(page);
  181 | });
  182 | 
  183 | for (const viewport of views) {
  184 |   test(`${viewport.name}: loading, empty and unavailable state matrix`, async ({ page, request }) => {
  185 |     test.setTimeout(90_000); await page.setViewportSize(viewport);
  186 |     for (const [name, api, path] of [['today', '**/api/today', 'today'], ['replenishment', '**/api/recommendations**', 'replenishment'], ['sku', `**/api/skus/${SKU}`, `skus/${SKU}`]]) {
  187 |       let release!: () => void; const blocked = new Promise<void>(resolve => { release = resolve; });
> 188 |       await page.route(api, async route => { await blocked; await route.continue(); });
      |                  ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
  189 |       await page.goto(`${BASE}/opus_a/${path}`); await expect(page.locator('.oa-skel').first()).toBeVisible();
  190 |       await page.screenshot({ path: `${OUT}/${name}-loading-${viewport.name}.png` }); release(); await ready(page); await page.unroute(api);
  191 |       await page.route(api, route => route.fulfill({ status: 503, json: { ok: false, message: 'Не удалось получить данные. Повторите попытку.' } }));
  192 |       await page.reload(); await expect(page.getByText('Данные недоступны').first()).toBeVisible(); await shot(page, `${name}-unavailable-${viewport.name}`); await noOverflow(page); await page.unroute(api);
  193 |     }
  194 |     await page.route('**/api/recommendations**', route => route.fulfill({ json: { ok: true, groups: [], state_version: 1 } }));
  195 |     await page.goto(`${BASE}/opus_a/replenishment`); await ready(page); await expect(page.getByText('Рекомендаций нет')).toBeVisible(); await shot(page, `replenishment-empty-${viewport.name}`); await page.unroute('**/api/recommendations**');
  196 |     const detail = await (await request.get(`${BASE}/api/skus/${SKU}`)).json();
  197 |     await page.route(`**/api/skus/${SKU}`, route => route.fulfill({ json: { ...detail, recommendation: null, sku: { ...detail.sku, image_url: null } } }));
  198 |     await page.goto(`${BASE}/opus_a/skus/${SKU}`); await ready(page); await expect(page.locator('.oa-sku-title img')).toHaveCount(0); await page.locator('#oa-rec').scrollIntoViewIfNeeded(); await shot(page, `sku-no-recommendation-${viewport.name}`); await noOverflow(page);
  199 |   });
  200 | }
  201 | 
  202 | test('order conflict binds reviewed version and cannot silently repeat approval', async ({ page, request }) => {
  203 |   const data = await (await request.get(`${BASE}/api/orders`)).json();
  204 |   const draft = { ...data.orders[0], state: 'draft', version: 7 }; let calls = 0;
  205 |   await page.route('**/api/orders', route => route.fulfill({ json: { ok: true, orders: [draft] } }));
  206 |   await page.route(`**/api/orders/${draft.id}/approve`, route => { calls++; expect(route.request().postDataJSON()).toEqual({ version: 7 }); return route.fulfill({ status: 409, json: { ok: false, code: 'stale_order_version', message: 'stale' } }); });
  207 |   await page.goto(`${BASE}/opus_a/today`); await ready(page); const order = page.locator('.oa-order');
  208 |   const opener = order.getByRole('button', { name: 'Проверить и утвердить' }); await opener.click(); await page.keyboard.press('Escape'); await expect(opener).toBeFocused(); await opener.click();
  209 |   const confirm = order.getByRole('button', { name: 'Утвердить заказ', exact: true }); await confirm.click(); await expect(order.getByText('Данные обновились')).toBeVisible(); await expect(confirm).toBeDisabled(); expect(calls).toBe(1); await shot(page, 'order-stale-desktop');
  210 | });
  211 | 
```