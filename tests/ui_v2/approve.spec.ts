import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// State-changing proof (runs once, after the read-only screens): draft adjustment → POST /api/proposals/:id/approve
// with {proposal_version, adjustments} → 200 + version+1 + PO draft; repeat with the old version → 409; ledger row present.
const EVIDENCE = join(__dirname, "..", "..", "docs", "evidence", "v2", "fable_ui_1");
mkdirSync(EVIDENCE, { recursive: true });
const shot = (page: import("@playwright/test").Page, name: string) => page.screenshot({ path: join(EVIDENCE, `${name}_1440x900.png`), fullPage: true, animations: "disabled" });
async function getJson(request: import("@playwright/test").APIRequestContext, url: string) {
  for (let i = 0; i < 3; i++) { try { return await (await request.get(url, { timeout: 60_000 })).json(); } catch (e) { if (i === 2) throw e; await new Promise(r => setTimeout(r, 1500)); } }
}

test.describe("Replenishment proof", () => {
  test("adjust draft → real approve with adjustments → ledger row", async ({ page, request }) => {
    await page.goto("/replenishment?supplier=SE");
    const first = page.locator("tr[role=button]").first();
    await expect(first).toBeVisible({ timeout: 20_000 });
    const code = (await first.locator("td").nth(1).innerText()).split("\n")[1].split(" · ")[0].trim();
    const before = Number((await first.locator("td").nth(6).innerText()).split("\n")[0].replace(/\D/g, ""));
    await first.click();
    const input = page.getByLabel("Скорректировать количество");
    await input.fill(String(before + 3));
    await page.getByRole("button", { name: "Добавить в корзину" }).click();
    await expect(first).toContainText("в корзине");
    await shot(page, "replenishment_adjust_before");
    const versionBefore = (await getJson(request, "/api/proposals?state=needs_review")).proposals.find((p: { subject_id: string }) => p.subject_id === "SE");
    await page.getByRole("button", { name: /Подготовить заказ SE/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "Черновик заказа — не отправлен" })).toBeVisible({ timeout: 20_000 });
    await shot(page, "replenishment_adjust_after");
    const after = await getJson(request, `/api/proposals/${versionBefore.id}`);
    expect(after.proposal.state).toBe("approved");
    expect(after.proposal.version).toBe(versionBefore.version + 1);
    const stale = await request.post(`/api/proposals/${versionBefore.id}/approve`, { data: { proposal_version: versionBefore.version }, timeout: 60_000 });
    expect(stale.status()).toBe(409);
    const ledger = await getJson(request, "/api/agent/ledger?limit=5");
    const row = ledger.rows.find((r: { summary_ru: string }) => r.summary_ru.includes(versionBefore.id));
    expect(row, "ledger row for the approval").toBeTruthy();
    const recs = await getJson(request, "/api/recommendations?supplier=SE");
    const rec = recs.groups[0].rows.find((r: { code_1c: string }) => r.code_1c === code);
    expect(rec.qty_adjusted).toBe(before + 3);
    // restore a fresh needs_review proposal pair for the remaining (mobile) tests
    const rerun = await request.post("/api/calc/run", { data: {}, timeout: 120_000 }); expect(rerun.ok()).toBeTruthy();
    writeFileSync(join(EVIDENCE, "adjust_approve_proof.json"), JSON.stringify({ code_1c: code, qty_before: before, qty_adjusted: rec.qty_adjusted, proposal: { id: versionBefore.id, version_before: versionBefore.version, version_after: after.proposal.version, state: after.proposal.state }, stale_repeat_status: stale.status(), ledger_row: row }, null, 2));
  });
});
