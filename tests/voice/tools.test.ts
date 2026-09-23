import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bumpStateVersion, db, resetInstance } from "../../src/db/client";
import { executeVoiceTool } from "../../src/voice/tools";
import * as views from "../../src/domain/views";
import { TranscriptGate, VoiceTurnGate } from "../../src/voice/transport";
import { POST as toolRoute } from "../../src/app/api/voice/tools/[name]/route";

const priorPath = process.env.DATABASE_PATH;
beforeEach(() => {
  resetInstance();
  process.env.DATABASE_PATH = ":memory:";
  db().prepare("INSERT INTO organization (id, name) VALUES (?, ?)").run("ORG-1", "Test");
  db().prepare("INSERT INTO supplier (id, name, lead_time_days) VALUES (?, ?, ?)").run("SE", "SE", 50);
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetInstance();
  if (priorPath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = priorPath;
});

describe("voice tool bridge", () => {
  function seedDemand(code = "CODE-1") {
    db().prepare("INSERT INTO sku (code_1c, supplier_id, name, unit_cost, moq) VALUES (?, ?, ?, ?, ?)").run(code, "SE", "Деталь", "12.50", 5);
    for (let index = 0; index < 12; index++) {
      const ym = `${index < 4 ? 2025 : 2026}-${String(index < 4 ? index + 9 : index - 3).padStart(2, "0")}`;
      db().prepare("INSERT INTO sales_month (code_1c, ym, qty_file) VALUES (?, ?, ?)").run(code, ym, "30");
      db().prepare("INSERT INTO sales_line (code_1c, doc_no, at, qty) VALUES (?, ?, ?, ?)").run(code, `DOC-${ym}`, `${ym}-15`, "30");
    }
    db().prepare("INSERT INTO stock_month (code_1c, ym, opening_qty) VALUES (?, ?, ?)").run(code, "2026-08", "0");
  }
  it("uses one canonical code for status, queue, explanation and a SKU calculation", async () => {
    seedDemand("CODE-1_");
    db().prepare("INSERT INTO agent_action (id, run_id, org_id, kind, code_1c, summary_ru, at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run("AR-SKU", "RUN-SKU", "ORG-1", "recompute", "CODE-1_", "Расчёт товара", "2026-09-23T00:00:00Z");
    const scope = { org_id: "ORG-1", supplier_id: "SE" };
    const status = await executeVoiceTool("what_changed", { request_id: "canonical-status", scope, args: { code_1c: "CODE-1" } });
    expect(status.result.changes).toHaveLength(1);
    const calculated = await executeVoiceTool("recommend_for", { request_id: "canonical-calc", scope, args: { code_1c: "CODE-1", utterance: "Рассчитай товар" } });
    expect(calculated.result).toMatchObject({ ok: true, recommended: 1 });
    const queue = await executeVoiceTool("what_needs_me", { request_id: "canonical-queue", scope, args: { code_1c: "CODE-1" } });
    expect(queue.result.items).toHaveLength(1);
    expect(queue.result.render).toMatchObject({ kind: "queue", purpose: "approvals", items: [{ kind: "proposal" }] });
    const explanation = await executeVoiceTool("explain_sku", { request_id: "canonical-explain", scope, args: { code_1c: "CODE-1" } });
    expect(explanation.result).toMatchObject({ ok: true, code_1c: "CODE-1_" });
    expect(explanation.result.render).toMatchObject({ kind: "sku_explain", code_1c: "CODE-1_", name: "Деталь" });
  });
  it("reads only confirmed ledger actions for a status question", async () => {
    db().prepare("INSERT INTO agent_action (id, run_id, org_id, kind, summary_ru, at) VALUES (?, ?, ?, ?, ?, ?)")
      .run("AR-1", "RUN-1", "ORG-1", "recommendation_prepared", "Расчёт сохранён", "2026-09-23T00:00:00Z");
    const response = await executeVoiceTool("what_changed", { request_id: "call-status", scope: { org_id: "ORG-1" }, args: {} });
    expect(response.status).toBe(200);
    expect(response.result.summary_ru).toBe("Расчёт сохранён");
    expect(response.result.changes).toHaveLength(1);
    expect(response.result.render).toMatchObject({ kind: "queue", purpose: "changes", items: [{ after: "Расчёт сохранён" }] });
    const since = response.result.state_version;
    db().prepare("INSERT INTO agent_action (id, run_id, org_id, kind, summary_ru, at) VALUES (?, ?, ?, ?, ?, ?)")
      .run("AR-2", "RUN-1", "ORG-1", "order_drafted", "Черновик создан", "2026-09-23T01:00:00Z");
    bumpStateVersion();
    const next = await executeVoiceTool("what_changed", { request_id: "call-status-next", scope: { org_id: "ORG-1" }, args: { since } });
    expect(next.result.summary_ru).toBe("Черновик создан");
    expect(next.result.changes).toHaveLength(1);
  });

  it("executes a duplicate transport delivery only once", async () => {
    seedDemand();
    const call = { request_id: "call-duplicate", scope: { org_id: "ORG-1", supplier_id: "SE" }, args: { supplier_id: "SE" } };
    const [first, second] = await Promise.all([
      executeVoiceTool("recommend_for", call), executeVoiceTool("recommend_for", call),
    ]);
    expect(first.result).toMatchObject({ ok: true, recommended: 1 });
    expect(first.result.render).toMatchObject({ kind: "calc_result", total: 1, items: [{ name: "Деталь", unit: "шт" }] });
    expect(second.result).toMatchObject({ ok: true, run_id: first.result.run_id, replayed: true });
    const changedArgs = await executeVoiceTool("recommend_for", { ...call, args: { supplier_id: "SE", category: "different" } });
    expect(changedArgs.result).toMatchObject({ run_id: first.result.run_id, replayed: true });
    expect(db().prepare("SELECT COUNT(*) AS n FROM calc_run").get()).toEqual({ n: 1 });
    expect(db().prepare("SELECT COUNT(*) AS n FROM proposal").get()).toEqual({ n: 1 });
    expect(db().prepare("SELECT state FROM proposal LIMIT 1").get()).toEqual({ state: "needs_review" });
    expect(db().prepare("SELECT COUNT(*) AS n FROM task").get()).toEqual({ n: 1 });
    expect(db().prepare("SELECT COUNT(*) AS n FROM approval").get()).toEqual({ n: 0 });
    expect(db().prepare("SELECT COUNT(*) AS n FROM purchase_order").get()).toEqual({ n: 0 });
    const proposal = db().prepare("SELECT id FROM proposal LIMIT 1").get() as { id: string };
    const queue = await executeVoiceTool("what_needs_me", { request_id: "call-after-run-queue", scope: { org_id: "ORG-1", supplier_id: "SE" }, args: {} });
    expect(queue.result.items).toMatchObject([{ id: proposal.id, kind: "proposal", href: `/review/${proposal.id}` }]);
    const changes = await executeVoiceTool("what_changed", { request_id: "call-after-run-ledger", scope: { org_id: "ORG-1", supplier_id: "SE" }, args: {} });
    expect((changes.result.changes as { after: string }[]).some(change => change.after.includes("Подготовлены рекомендации SE"))).toBe(true);
    expect((changes.result.changes as { after: string }[]).some(change => change.after.includes("Нужно решение по заказу SE"))).toBe(true);
    const turn = new VoiceTurnGate();
    turn.cancel(); // Same gate used by stop(); the durable review task is independent of the call.
    expect(db().prepare("SELECT state FROM task LIMIT 1").get()).toEqual({ state: "needs_review" });
    const explanation = await executeVoiceTool("explain_sku", { request_id: "call-explain", scope: { org_id: "ORG-1", supplier_id: "SE", code_1c: "CODE-1" }, args: { code_1c: "CODE-1" } });
    expect(explanation.result).toMatchObject({ ok: true, code_1c: "CODE-1", components: { on_hand: 0 } });
    expect(typeof explanation.result.rationale_ru).toBe("string");
  });

  it("returns the first result to a duplicate while a slow tool is running", async () => {
    const view = vi.spyOn(views, "queueView").mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 2200));
      return { items: [{ id: "PR-1", kind: "proposal", title: "Проверить заказ SE", why: "Требуется решение", sources: [], money_at_stake: null, options: [], href: "/review/PR-1", since: "2026-09-23" }] };
    });
    const call = { request_id: "call-slow-duplicate", scope: { org_id: "ORG-1" }, args: {} };
    const [first, second] = await Promise.all([executeVoiceTool("what_needs_me", call), executeVoiceTool("what_needs_me", call)]);
    expect(first.result).toMatchObject({ ok: true, items: [{ id: "PR-1" }] });
    expect(second.result).toMatchObject({ ok: true, replayed: true, items: [{ id: "PR-1" }] });
    expect(view).toHaveBeenCalledTimes(1);
    view.mockRestore();
  });

  it("rejects a SKU outside the current supplier", async () => {
    db().prepare("INSERT INTO supplier (id, name, lead_time_days) VALUES (?, ?, ?)").run("IEK", "IEK", 40);
    db().prepare("INSERT INTO sku (code_1c, supplier_id, name) VALUES (?, ?, ?)").run("SKU-1", "IEK", "Part");
    const response = await executeVoiceTool("explain_sku", { request_id: "call-scope", scope: { org_id: "ORG-1", supplier_id: "SE" }, args: { code_1c: "SKU-1" } });
    expect(response.status).toBe(403);
    expect(response.result.code).toBe("denied");
  });

  it("keeps status actions inside the current supplier scope", async () => {
    db().prepare("INSERT INTO supplier (id, name, lead_time_days) VALUES (?, ?, ?)").run("IEK", "IEK", 40);
    db().prepare("INSERT INTO sku (code_1c, supplier_id, name) VALUES (?, ?, ?)").run("SE-1", "SE", "Part SE");
    db().prepare("INSERT INTO sku (code_1c, supplier_id, name) VALUES (?, ?, ?)").run("IEK-1", "IEK", "Part IEK");
    const add = db().prepare("INSERT INTO agent_action (id, run_id, org_id, code_1c, kind, summary_ru, at) VALUES (?, 'RUN-1', 'ORG-1', ?, 'recompute', ?, '2026-09-23')");
    add.run("AR-SE", "SE-1", "SE updated");
    add.run("AR-IEK", "IEK-1", "IEK updated");
    const response = await executeVoiceTool("what_changed", { request_id: "call-scoped-status", scope: { org_id: "ORG-1", supplier_id: "SE" }, args: {} });
    expect(response.result.summary_ru).toBe("SE updated");
  });

  it("labels a malformed transport payload", async () => {
    const response = await toolRoute(new Request("http://localhost/api/voice/tools/what_changed", { method: "POST", body: "{" }), { params: Promise.resolve({ name: "what_changed" }) });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "invalid", labels: { provenance: "Partner data · anonymised" }, state_version: 1 });
  });

  it("does not create a run for a corrected, ambiguous spoken quantity", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const transcript = new TranscriptGate();
    for (const event of [
      { type: "input_audio_buffer.speech_started", item_id: "input-ambiguous" },
      { type: "conversation.item.input_audio_transcription.completed", item_id: "input-ambiguous", text: "Закажи тринадцать… нет, четырнадцать тысяч" },
    ]) {
      if (event.type === "input_audio_buffer.speech_started") transcript.started(event.item_id);
      else transcript.completed(event.item_id, event.text!);
    }
    const response = await executeVoiceTool("recommend_for", {
      request_id: "call-ambiguous", scope: { org_id: "ORG-1", supplier_id: "SE" },
      args: { supplier_id: "SE", utterance: transcript.take() },
    });
    expect(response.status).toBe(422);
    expect(response.result.code).toBe("needs_clarification");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects a stale purchase view before a calculation", async () => {
    const response = await executeVoiceTool("recommend_for", {
      request_id: "call-stale", scope: { org_id: "ORG-1", supplier_id: "SE" },
      args: { supplier_id: "SE", expected_state_version: 0 },
    });
    expect(response.status).toBe(409);
    expect(response.result.code).toBe("stale");
    expect(db().prepare("SELECT COUNT(*) AS n FROM calc_run").get()).toEqual({ n: 0 });
  });
});
