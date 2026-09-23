import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import fs from 'node:fs';

type Measurement = { page: string; ttfb: number; load: number };
let page: Page, context: BrowserContext, authenticated = false, sku = '';
const timings: Measurement[] = [], api: { path: string; status: number; ms: number }[] = [];
const errors: string[] = [];
let actions = 0;
const cases: { title: string; run: () => Promise<void> }[] = [];
const scenario = (title: string, run: () => Promise<void>) => cases.push({title, run});
let currentNotes: string[] = [];
const results: {step: string; status: string; detail: string}[] = [];
const note = (text: string) => currentNotes.push(text);
const check = (ok: unknown, message: string) => { if (!ok) { note(message); throw new Error(message); } };
function waitResponse(predicate: Parameters<Page['waitForResponse']>[0]) {
  const pending = page.waitForResponse(predicate, {timeout: 15_000});
  // A failed click must not leave an unhandled response waiter that aborts later steps.
  void pending.catch(() => {});
  return pending;
}
async function go(path: string) {
  check(authenticated, 'P1: access gate did not complete; downstream check blocked');
  await page.goto(path);
  await expect(page.locator('main')).toBeVisible();
  const t = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming; return { ttfb: n.responseStart - n.requestStart, load: n.duration }; });
  timings.push({ page: path, ...t });
}
async function get(path: string) {
  const r = await context.request.get(path, { timeout: 10_000 });
  check(r.ok(), `P1: GET ${path} HTTP ${r.status()}`);
  return r.json();
}
async function shot(name: string) {
  const dir = `docs/evidence/e2e/${test.info().project.name}`;
  fs.mkdirSync(dir, { recursive: true });
  // All editable controls are masked, even on failed authentication; no trace/video/HAR.
  const buffer = await page.screenshot({ type: 'jpeg', quality: 55, fullPage: false,
    mask: [page.locator('input, textarea')], animations: 'disabled', timeout: 8_000 });
  check(buffer.length <= 400 * 1024, 'P3: screenshot exceeds 400 KB');
  fs.writeFileSync(`${dir}/${name}.jpg`, buffer);
}

test.beforeAll(async ({ browser }) => {
  check(process.env.E2E_BASE_URL && process.env.DEMO_ACCESS_CODE, 'Required environment is missing');
  context = await browser.newContext({ ...test.info().project.use });
  page = await context.newPage();
  page.setDefaultTimeout(8_000);
  page.on('console', m => { if (m.type() === 'error') errors.push('console error'); });
  page.on('pageerror', () => errors.push('uncaught page exception'));
  page.on('requestfinished', async request => {
    const r = await request.response();
    if (!r) return;
    const path = new URL(r.url()).pathname;
    if (path.startsWith('/api/')) {
      const t = r.request().timing();
      api.push({ path, status: r.status(), ms: Math.max(0, t.responseEnd) });
    }
  });
  // Browser-side ceiling, in addition to the server daily cap. No background playback.
  await page.route('**/api/**', async route => {
    const req = route.request();
    if (req.method() === 'POST' && !new URL(req.url()).pathname.includes('/access')) {
      actions++;
      if (actions > 12) { await route.abort(); return; }
    }
    await route.continue();
  });
});
test.afterAll(async () => {
  const dir = `docs/evidence/e2e/${test.info().project.name}`;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/measurements.json`, JSON.stringify({ timings, api, consoleErrors: errors, writeActions: actions }, null, 2));
  await context?.close();
});

scenario('01 access and Today shell', async () => {
  await page.goto('/');
  await expect(page.locator('input[type=password]')).toBeVisible();
  await shot('00-access-empty');
  // Never expose fill errors: Playwright may include the submitted value in its call log.
  try {
    await page.locator('input[type=password]').fill(process.env.DEMO_ACCESS_CODE!);
    await page.getByRole('button', { name: /Открыть демо/ }).click();
    await page.waitForURL('**/today');
  } catch { throw new Error('P1: access submission failed (authentication details suppressed)'); }
  authenticated = true;
  await expect(page.getByRole('heading', { name: 'Сегодня', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: test.info().project.name === 'phone' ? 'Быстрая навигация' : 'Основные разделы' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Денежный пульс' })).toBeVisible();
  const body = await page.locator('body').innerText();
  check(!/undefined|\{\s*"\w+"\s*:/.test(body), 'P2: shell exposes undefined or raw JSON');
  await page.waitForTimeout(800);
  check(errors.length === 0, `P2: shell has ${errors.length} console/page errors`);
});

scenario('02 Pulse numbers', async () => {
  await go('/today');
  await get('/api/today');
  const pulse = page.getByRole('region', { name: 'Денежный пульс' });
  await expect(pulse.locator('strong').last()).toContainText(/\d/);
  const values = await pulse.locator('strong').allTextContents();
  check(values.length >= 4 && values.every(v => /\d/.test(v)), 'P2: Pulse metrics contain nonnumeric values: ' + values.join(' / '));
  note('Pulse: ' + values.join(' / '));
});

scenario('03 supplier groups and SKU links', async () => {
  await go('/replenishment');
  const initial = await get('/api/recommendations');
  if (!initial.groups?.some((g: {rows: unknown[]}) => g.rows.length)) {
    const calculated = waitResponse(r => r.url().endsWith('/api/calc/run') && r.request().method() === 'POST');
    await page.getByRole('button', {name: 'Запустить расчёт', exact: true}).click();
    const r = await calculated;
    check(r.ok(), `P1: initial calculation HTTP ${r.status()}`);
    note('Empty recommendations: prepared deterministic calculation through UI');
  }
  await expect(page.getByRole('region', { name: /^Рекомендации / }).first()).toBeVisible();
  const links = page.locator('tbody a[href^="/skus/"]');
  await expect(links.first()).toBeVisible();
  sku = decodeURIComponent((await links.first().getAttribute('href'))!.split('/').pop()!);
  check(await page.locator('tbody tr').count() > 0, 'P1: supplier groups have no SKU rows');
});

scenario('04 SKU chart sources and facts', async () => {
  await go('/replenishment');
  const link = page.locator('tbody a[href^="/skus/"]').first();
  const reachable = await link.waitFor({state: 'visible', timeout: 8_000}).then(() => true, () => false);
  if (reachable) {
    sku = decodeURIComponent((await link.getAttribute('href'))!.split('/').pop()!);
    await link.click();
  } else {
    note('P1: supplier-row navigation unavailable; direct real-SKU diagnostic fallback');
    const data = await get('/api/skus?limit=1&supplier=SE');
    sku = data.items[0].code_1c;
    await go(`/skus/${encodeURIComponent(sku)}`);
  }
  await expect(page).toHaveURL(/\/skus\//);
  await expect(page.getByRole('img', { name: 'Продажи, регулярный спрос и прогноз' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Факты о товаре' })).toBeVisible();
  await expect(page.locator('dl').first().locator('dd').first()).toContainText(/\d/);
  const source = page.locator('[aria-label="Источник, AI, внешнее действие"]').first();
  await expect(source).toBeVisible();
  await expect(source).not.toContainText('Источник не указан');
  check(reachable, 'P1: SKU only reachable by direct diagnostic navigation; supplier-row path blocked');
});

scenario('05 adjust recommendation and ledger', async () => {
  await go('/replenishment');
  await get('/api/recommendations');
  const edit = page.getByRole('button', { name: /^Изменить qty / }).first();
  await expect(edit).toBeVisible();
  const code = (await edit.getAttribute('aria-label'))!.replace('Изменить qty ', '');
  const before = await get(`/api/skus/${encodeURIComponent(code)}`);
  const ledgerBefore = JSON.stringify(await get('/api/agent/ledger?limit=50'));
  await edit.click();
  const form = page.getByRole('form', { name: `Изменить количество ${code}` });
  const qty = Number(await form.locator('[name=qty]').inputValue()) + 1;
  await form.locator('[name=qty]').fill(String(qty));
  await form.locator('[name=reason]').fill('E2E judge quantity check');
  await expect(form.getByRole('button', {name: 'Сохранить количество'})).toBeEnabled();
  const response = waitResponse(r => /\/recommendations\/.*\/adjust$/.test(r.url()) && r.request().method() === 'POST');
  await form.getByRole('button', { name: 'Сохранить количество' }).click();
  const r = await response;
  check(r.ok(), `P1: recommendation write route HTTP ${r.status()}`);
  await expect(form.getByRole('status')).toContainText('Количество сохранено');
  const after = await get(`/api/skus/${encodeURIComponent(code)}`);
  check(after.recommendation.version > before.recommendation.version && after.recommendation.qty_adjusted === qty, 'P2: quantity/version did not persist');
  const ledger = JSON.stringify(await get('/api/agent/ledger?limit=50'));
  check(ledger !== ledgerBefore && ledger.includes(code), 'P2: ledger does not show adjusted SKU action');
  note(`Quantity persisted; version ${before.recommendation.version} → ${after.recommendation.version}`);
});

scenario('06 approve proposal draft and export', async () => {
  await go('/review');
  const proposals = await get('/api/proposals');
  const candidates = proposals.proposals.filter((p: {kind:string;state:string}) => p.kind === 'supplier_order' && p.state === 'needs_review');
  // Match the visible queue, not an unrelated historical proposal returned by the API.
  await page.getByRole('region', {name: 'Очередь решений'}).locator('a[href^="/review/"]').first().waitFor({state: 'visible', timeout: 8_000}).catch(() => {});
  const hrefs = await page.getByRole('region', {name: 'Очередь решений'}).locator('a').evaluateAll(es => es.map(e => e.getAttribute('href')));
  const proposal = candidates.find((p: {id:string}) => hrefs.includes(`/review/${p.id}`));
  check(!candidates.length || proposal, 'P1: reviewable supplier proposals are not linked from the visible queue');
  if (!proposal) { note('No supplier proposal present; approval/export unverified'); return; }
  const link = page.locator(`a[href="/review/${proposal.id}"]`).first();
  await expect(link).toBeVisible(); await link.click();
  const response = waitResponse(r => r.url().endsWith(`/api/proposals/${proposal.id}/approve`));
  await page.getByRole('button', { name: /Утвердить/ }).click();
  const r = await response; check(r.ok(), `P1: proposal approval HTTP ${r.status()}`);
  const body = await r.json(); check(body.po_id, 'P1: approval did not return PO');
  await page.getByRole('link', { name: 'Открыть заказ' }).click();
  const po = (await get(`/api/orders/${body.po_id}`)).order;
  check(['draft','approved'].includes(po.state), 'P2: approval produced unexpected PO state');
  note(`PO state after proposal approval: ${po.state}`);
  if (po.state === 'draft') {
    await expect(page.getByText('Черновик заказа — не отправлен', { exact: true }).first()).toBeVisible();
    const approve = waitResponse(r => r.url().endsWith(`/api/orders/${body.po_id}/approve`));
    await page.getByRole('button', { name: 'Утвердить заказ', exact: true }).click();
    check((await approve).ok(), 'P1: PO approval failed');
  }
  const download = page.waitForEvent('download', {timeout: 15_000});
  void download.catch(() => {});
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const file = await download;
  check(!await file.failure(), 'P1: export download failed');
  const stream = await file.createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString('utf8');
  check(['Номенклатура.Код', 'Код 1с'].some(header => csv.split(/\r?\n/)[0].includes(header)), 'P1: export lacks 1С code column');
  check(csv.split(/\r?\n/).length > 1, 'P1: export has no rows');
  note(`Downloaded CSV: ${Buffer.byteLength(csv)} bytes; 1С code header present (file not retained)`);
});

scenario('07 money cash and commitments', async () => {
  await go('/money');
  await expect(page.locator('h1')).toContainText(/Деньги|Финансы/);
  await expect(page.locator('main')).toContainText(/Обязательства|обязательства/);
  const data = await get('/api/money');
  await expect(page.getByRole('region', {name: 'Денежные показатели'}).locator('strong').last()).toContainText(/\d/);
  check(Array.isArray(data.cash) && Array.isArray(data.committed_by_supplier), 'P2: money cash/commitment data unavailable');
  note(`Cash records: ${data.cash.length}; supplier commitments: ${data.committed_by_supplier.length}; empty cash is disclosed by UI`);
  check(!/undefined/.test(await page.locator('main').innerText()), 'P2: money renders undefined');
});

scenario('08 world in-transit update and Play', async () => {
  await go('/world');
  const recommendations = await get('/api/recommendations');
  const rows = recommendations.groups.flatMap((g: {rows: Record<string, unknown>[]}) => g.rows);
  const candidate = rows.find((r: {qty_recommended: number; moq?: number; components?: {moq?:number}}) => r.qty_recommended > 100 && Number(r.moq ?? r.components?.moq ?? 1) <= 100);
  check(candidate, 'P1: no recommendation above 100 with MOQ ≤100 to verify in-transit effect');
  const code = candidate.code_1c;
  const before = await get(`/api/skus/${encodeURIComponent(code)}`);
  if (!before.recommendation) note('P2: real SKU has no starting recommendation; change cannot be verified');
  await page.getByRole('button', { name: 'Сочинить событие', exact: true }).click();
  await page.getByRole('button', { name: 'Товар в пути', exact: true }).click();
  await page.getByRole('textbox', { name: 'Код 1С', exact: true }).fill(code);
  await page.getByLabel('Количество, шт.', { exact: true }).fill('100');
  await page.getByLabel('Текст события', { exact: true }).fill(`E2E ${test.info().project.name} +100 ${Date.now()}`);
  const compose = waitResponse(r => r.url().endsWith('/api/world/compose'));
  await page.getByRole('button', { name: 'Добавить событие' }).click();
  const r = await compose; check(r.ok(), `P1: world compose HTTP ${r.status()}`);
  await expect(page.getByText(/Событие сохранено/)).toBeVisible();
  const play = waitResponse(r => r.url().endsWith('/api/world/play'));
  await page.getByRole('button', { name: 'Воспроизвести', exact: true }).click();
  check((await play).ok(), 'P1: world Play failed');
  const after = await get(`/api/skus/${encodeURIComponent(code)}`);
  check(before.recommendation && after.recommendation && after.recommendation.qty_recommended < before.recommendation.qty_recommended, 'P2: +100 in transit did not reduce recommendation after Play');
  note(`${code}: ${before.recommendation.qty_recommended} → ${after.recommendation.qty_recommended}; compose may process immediately`);
});

scenario('09 typed assistant truth-labelled result', async () => {
  await go('/assistant');
  const question = 'что нужно заказать у SE?';
  await page.getByRole('textbox', { name: 'Сообщение помощнику' }).fill(question);
  const response = waitResponse(r => r.url().endsWith('/api/assistant/message'));
  await page.getByRole('button', { name: 'Отправить сообщение' }).click();
  const r = await response; check(r.ok(), `P1: assistant HTTP ${r.status()}`);
  const card = page.getByRole('article', { name: question });
  await expect(card).toBeVisible();
  await expect(card.locator('[aria-label="Источник, AI, внешнее действие"]')).toBeVisible();
  check(!/не указан/.test(await card.innerText()), 'P2: assistant truth axes are unknown');
});

scenario('10 keyboard visible focus', async () => {
  await go('/today');
  const observations = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    observations.push(await page.evaluate(() => {
      const e = document.activeElement as HTMLElement; const s = getComputedStyle(e), r = e.getBoundingClientRect();
      return { tag: e.tagName, visible: r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight,
        ring: (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 && s.outlineColor !== 'rgba(0, 0, 0, 0)') || s.boxShadow !== 'none' };
    }));
  }
  note(JSON.stringify(observations));
  check(observations.every(o => o.visible && o.ring), 'P3: Tab target lacks visible focus ring');
});

scenario('11 phone overflow and primary targets', async () => {
  if (test.info().project.name !== 'phone') { note('Phone-only checks'); return; }
  const problems: string[] = [];
  for (const path of ['/today','/replenishment','/money','/world','/assistant']) {
    await go(path);
    await page.waitForTimeout(350);
    const size = await page.evaluate(() => ({ scroll: document.scrollingElement!.scrollWidth, width: innerWidth }));
    if (size.scroll > size.width) problems.push(`${path}: width ${size.scroll} > ${size.width}`);
    const buttons = await page.locator('button[class*="primary"], button[class*="Primary"]').evaluateAll(es => es.filter(e => (e as HTMLElement).offsetWidth).map(e => { const r = e.getBoundingClientRect(); return { text: e.getAttribute('aria-label') || e.textContent, w: r.width, h: r.height }; }));
    note(`${path}: width ${size.scroll}/${size.width}; primary buttons ${buttons.length}; ${buttons.map(b => `${b.w}×${b.h}`).join(', ')}`);
    for (const b of buttons) if (b.w < 44 || b.h < 44) problems.push(`${path}: ${b.text} ${b.w}×${b.h}`);
    await shot(`11-${path.slice(1)}`);
  }
  check(!problems.length, 'P3: ' + problems.join('; '));
});

scenario('12 latency and browser errors', async () => {
  const slow = timings.filter(t => t.ttfb > 1500).map(t => `${t.page} TTFB ${Math.round(t.ttfb)}ms`);
  const slowApi = api.filter(t => t.ms > 1000).map(t => `${t.path} ${Math.round(t.ms)}ms`);
  note(`Console/page errors: ${errors.length}; write actions: ${actions}; slow pages: ${slow.join(', ') || 'none'}; slow APIs: ${slowApi.join(', ') || 'none'}`);
  check(!errors.length && !slow.length && !slowApi.length, 'P2: browser errors or requested latency thresholds exceeded');
});

// Individual browser actions and judge steps remain bounded at 20 seconds.
// One journey preserves the authenticated page when a step fails.
test('hosted judge journey', async () => {
  test.setTimeout(300_000);
  for (const item of cases) {
    currentNotes = [];
    let status = 'PASS';
    const start = Date.now();
    try { await test.step(item.title, item.run, {timeout: 20_000}); }
    catch (error) { status = 'FAIL'; const message = error instanceof Error ? error.message.replace(/\u001b\[[0-9;]*m/g, '').split('Call log:')[0].slice(0, 400).replace(/\n/g, ' ') : 'Step failed'; if (!currentNotes.includes(message)) currentNotes.push(message); }
    if (currentNotes.some(n => n.includes('unverified') || n === 'Phone-only checks')) status = 'SKIP';
    try { await shot(item.title.split(' ')[0]); } catch { status = 'FAIL'; currentNotes.push('Screenshot capture failed'); }
    results.push({step: item.title, status, detail: `${Date.now()-start} ms; ${currentNotes.join('; ')}`});
    fs.writeFileSync(`docs/evidence/e2e/${test.info().project.name}/steps.json`, JSON.stringify(results, null, 2));
    if (!page.isClosed()) await page.waitForTimeout(1500);
  }
  fs.writeFileSync(`docs/evidence/e2e/${test.info().project.name}/steps.json`, JSON.stringify(results, null, 2));
  expect(results.filter(r => r.status === 'FAIL').map(r => r.step), 'Failed judge steps (see steps.json)').toEqual([]);
});
