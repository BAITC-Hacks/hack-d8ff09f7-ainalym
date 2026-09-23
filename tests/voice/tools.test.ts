import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bumpStateVersion, db, resetInstance } from "../../src/db/client";
import { executeVoiceTool } from "../../src/voice/tools";

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
  it("reads only confirmed ledger actions for a status question", async () => {
    db().prepare("INSERT INTO agent_action (id, run_id, org_id, kind, summary_ru, at) VALUES (?, ?, ?, ?, ?, ?)")
      .run("AR-1", "RUN-1", "ORG-1", "recommendation_prepared", "Расчёт сохранён", "2026-09-23T00:00:00Z");
    const response = await executeVoiceTool("what_changed", { request_id: "call-status", scope: { org_id: "ORG-1" }, args: {} });
    expect(response.status).toBe(200);
    expect(response.result.summary_ru).toBe("Расчёт сохранён");
    expect(response.result.changes).toHaveLength(1);
    const since = response.result.state_version;
    db().prepare("INSERT INTO agent_action (id, run_id, org_id, kind, summary_ru, at) VALUES (?, ?, ?, ?, ?, ?)")
      .run("AR-2", "RUN-1", "ORG-1", "order_drafted", "Черновик создан", "2026-09-23T01:00:00Z");
    bumpStateVersion();
    const next = await executeVoiceTool("what_changed", { request_id: "call-status-next", scope: { org_id: "ORG-1" }, args: { since } });
    expect(next.result.summary_ru).toBe("Черновик создан");
    expect(next.result.changes).toHaveLength(1);
  });

  it("executes a duplicate transport delivery only once", async () => {
    const fetcher = vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
      return Response.json({ ok: true, run_id: "RUN-1", recommended: 1 });
    });
    vi.stubGlobal("fetch", fetcher);
    const call = { request_id: "call-duplicate", scope: { org_id: "ORG-1", supplier_id: "SE" }, args: { supplier_id: "SE" } };
    const [first, second] = await Promise.all([
      executeVoiceTool("recommend_for", call), executeVoiceTool("recommend_for", call),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(first.result).toMatchObject({ ok: true, run_id: "RUN-1" });
    expect(second.result).toMatchObject({ ok: true, run_id: "RUN-1", replayed: true });
  });

  it("rejects a SKU outside the current supplier", async () => {
    db().prepare("INSERT INTO supplier (id, name, lead_time_days) VALUES (?, ?, ?)").run("IEK", "IEK", 40);
    db().prepare("INSERT INTO sku (code_1c, supplier_id, name) VALUES (?, ?, ?)").run("SKU-1", "IEK", "Part");
    const response = await executeVoiceTool("explain_sku", { request_id: "call-scope", scope: { org_id: "ORG-1", supplier_id: "SE" }, args: { code_1c: "SKU-1" } });
    expect(response.status).toBe(403);
    expect(response.result.code).toBe("denied");
  });

  it("does not create a run for a corrected, ambiguous spoken quantity", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const response = await executeVoiceTool("recommend_for", {
      request_id: "call-ambiguous", scope: { org_id: "ORG-1", supplier_id: "SE" },
      args: { supplier_id: "SE", utterance: "Закажи тринадцать… нет, четырнадцать тысяч" },
    });
    expect(response.status).toBe(422);
    expect(response.result.code).toBe("needs_clarification");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
