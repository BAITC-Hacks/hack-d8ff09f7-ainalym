// Evidence for the OPUS-B lane: real-data screenshots (1440×900 + 390×844) and keyboard proofs.
// Run from the worktree root with the dev server on :3120:  node docs/evidence/opus_b/shoot.mjs
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const BASE = process.env.OB_BASE ?? "http://localhost:3120";
const OUT = "docs/evidence/opus_b";
const SKU = process.env.OB_SKU ?? "130200122_";
const log = [];
const note = line => { log.push(line); console.log(line); };
const hideDevChrome = page => page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
const focused = page => page.evaluate(() => { const el = document.activeElement; if (!el) return "none"; const label = el.getAttribute("aria-label") || el.textContent || ""; return `${el.tagName.toLowerCase()}${el.getAttribute("role") ? `[role=${el.getAttribute("role")}]` : ""} «${label.replace(/\s+/g, " ").trim().slice(0, 60)}»`; });
const browser = await chromium.launch();
const viewports = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
async function open(path, vp, ready) {
  const page = await browser.newPage({ viewport: viewports[vp], deviceScaleFactor: vp === "phone" ? 2 : 1, timezoneId: "Asia/Almaty", locale: "ru-RU" });
  const errors = []; page.on("pageerror", e => errors.push(String(e))); page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(ready, { timeout: 90000 });
  await hideDevChrome(page); await page.waitForTimeout(1500);
  return { page, errors };
}
// 1. Today
for (const vp of ["desktop", "phone"]) {
  const { page, errors } = await open("/opus_b/today", vp, "text=Требует вашего решения");
  await page.waitForSelector("text=версия", { timeout: 60000 });
  await page.screenshot({ path: `${OUT}/today-${vp}.png` });
  await page.screenshot({ path: `${OUT}/today-${vp}-full.png`, fullPage: true });
  note(`today ${vp}: console errors ${errors.length}`);
  if (vp === "desktop") {
    const order = []; await page.locator("body").click({ position: { x: 5, y: 5 } });
    for (let i = 0; i < 9; i++) { await page.keyboard.press("Tab"); order.push(await focused(page)); }
    note(`today Tab order: ${order.join(" → ")}`);
    await page.screenshot({ path: `${OUT}/today-desktop-focus.png` });
    await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
    note(`today ⌘K focus: ${await focused(page)}`);
    await page.locator("input[role=combobox]").pressSequentially("0103000", { delay: 40 }); await page.waitForSelector("[role=option]", { timeout: 20000 });
    await page.screenshot({ path: `${OUT}/today-desktop-search.png` });
    await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
    await page.waitForURL(/\/opus_b\/skus\//, { timeout: 30000 });
    note(`today search ↓ Enter → ${new URL(page.url()).pathname}`);
  }
  await page.close();
}

// 1b. Today honest states (desktop). Stale = the REAL server 409 (approve re-sent with a wrong version);
// unavailable / empty / loading = network interception of the read routes (clearly synthetic, never a write).
{
  const { page } = await open("/opus_b/today", "desktop", "text=версия");
  await page.route("**/api/proposals/*/approve", route => route.continue({ postData: JSON.stringify({ proposal_version: 999 }) }));
  await page.getByRole("button", { name: "Подготовить заказ" }).first().click();
  await page.waitForSelector("text=Данные обновились — обновите", { timeout: 20000 });
  await page.locator("text=Данные обновились — обновите").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/today-state-stale.png` });
  note("today stale: real server 409 on approve(version 999) → «Данные обновились — обновите» shown, nothing approved");
  await page.close();
}
for (const [kind, handler] of [
  ["unavailable", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, code: "provider_unavailable", message: "Сервис очереди не отвечает (перехват для проверки)" }) })],
  ["empty", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, provenance: "partner_anonymised", ai: "rules", external: "export_only", items: [], state_version: 1 }) })],
]) {
  const page = await browser.newPage({ viewport: viewports.desktop, timezoneId: "Asia/Almaty", locale: "ru-RU" });
  await page.route("**/api/queue", handler);
  await page.goto(`${BASE}/opus_b/today`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(kind === "empty" ? "text=Решений не ждёт" : "text=Очередь решений недоступна", { timeout: 60000 });
  await hideDevChrome(page); await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/today-state-${kind}.png` });
  note(`today ${kind}: shown (queue route intercepted)`);
  await page.close();
}
{
  const page = await browser.newPage({ viewport: viewports.desktop, timezoneId: "Asia/Almaty", locale: "ru-RU" });
  await page.route("**/api/today", async route => { await new Promise(r => setTimeout(r, 4000)); await route.continue(); });
  await page.goto(`${BASE}/opus_b/today`, { waitUntil: "domcontentloaded" });
  await hideDevChrome(page); await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/today-state-loading.png` });
  note("today loading: skeleton captured while /api/today is delayed 4 s");
  await page.close();
}
// 2. Replenishment
for (const vp of ["desktop", "phone"]) {
  const { page, errors } = await open("/opus_b/replenishment", vp, "tbody tr[tabindex]");
  await page.screenshot({ path: `${OUT}/replenishment-${vp}.png` });
  note(`replenishment ${vp}: console errors ${errors.length}`);
  const first = page.locator("tbody tr[tabindex='0']").first();
  await first.focus(); const a = await focused(page);
  await page.keyboard.press("ArrowDown"); const b = await focused(page);
  await page.keyboard.press("Enter"); await page.waitForSelector("text=Потребность", { timeout: 20000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/replenishment-${vp}-expanded.png` });
  if (vp === "desktop") {
    await page.keyboard.press("Escape"); await page.waitForTimeout(200);
    const expandedLeft = await page.locator("text=Страховой запас").count();
    note(`replenishment keys: focus ${a} → ↓ ${b} → Enter opens rationale → Esc closes (tape cells left: ${expandedLeft}), focus ${await focused(page)}`);
  }
  await page.close();
}

// 2b. Replenishment adjust: the contract route POST /api/recommendations/:id/adjust is not on main yet →
// the REAL server 404 must render the honest unavailable state (nothing is changed).
if (!process.env.OB_SKIP_ADJUST) {
  const { page } = await open("/opus_b/replenishment", "desktop", "tbody tr[tabindex]");
  await page.locator("tbody tr[tabindex='0']").first().focus(); await page.keyboard.press("Enter");
  await page.waitForSelector("text=Причина", { timeout: 20000 });
  await page.getByLabel("Причина").first().fill("акция у клиента");
  await page.getByRole("button", { name: "Сохранить" }).first().click();
  const msg = page.locator("text=Правка на сервере пока недоступна").first();
  await msg.waitFor({ timeout: 20000 }); await msg.scrollIntoViewIfNeeded(); await page.mouse.wheel(0, 160); await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/replenishment-state-adjust-unavailable.png` });
  note("replenishment adjust: real server 404 (route not on main) → «Правка на сервере пока недоступна — количество не изменено»");
  await page.close();
}
// 3. SKU card
for (const vp of ["desktop", "phone"]) {
  const { page, errors } = await open(`/opus_b/skus/${SKU}`, vp, "text=Источники");
  await page.screenshot({ path: `${OUT}/sku-${vp}.png` });
  await page.screenshot({ path: `${OUT}/sku-${vp}-full.png`, fullPage: true });
  note(`sku ${vp}: console errors ${errors.length}`);
  if (vp === "desktop") {
    const chart = page.locator("[data-ob-chart]").first();
    if (await chart.count()) {
      await chart.focus(); const before = await page.locator("[data-ob-chart-live]").first().textContent().catch(() => "");
      await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(200);
      const after = await page.locator("[data-ob-chart-live]").first().textContent().catch(() => "");
      await page.screenshot({ path: `${OUT}/sku-desktop-chart-keys.png` });
      note(`sku chart keys: «${(before ?? "").trim().slice(0, 80)}» → ← ← → «${(after ?? "").trim().slice(0, 80)}»`);
    } else note("sku chart keys: chart hook [data-ob-chart] not found");
  }
  await page.close();
}
await browser.close();
writeFileSync(`${OUT}/keyboard.txt`, `${log.join("\n")}\n`);
