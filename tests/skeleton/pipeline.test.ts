import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetInstance, stateVersion } from "../../src/db/client";
import { onEvent } from "../../src/server/pipeline";
import { GET as today } from "../../src/app/api/today/route";
import { GET as queue } from "../../src/app/api/queue/route";

vi.mock("@/ai/worker", () => ({ processEvent: vi.fn(async () => ({ run_id: null, actions: 0, escalations: 0 })) }));

describe("world inbox and reviewer views", () => {
  beforeEach(() => {
    resetInstance();
    db().prepare("INSERT INTO organization (id,name,payload) VALUES (?,?,?)").run("partner", "Partner", '{"opening_cash":[]}');
  });
  afterEach(() => resetInstance());

  it("inserts one pending event per source and replays without a second write", async () => {
    const input = { org_id: "partner", code_1c: "SKU-1", payload: { delta_qty: 100 } };
    const first = await onEvent("in_transit_update", input, "SOURCE-1");
    const afterFirst = stateVersion();
    const second = await onEvent("in_transit_update", input, "SOURCE-1");
    expect(second).toEqual({ event_id: first.event_id, run_id: null, replayed: true });
    expect(stateVersion()).toBe(afterFirst);
    expect((db().prepare("SELECT COUNT(*) AS n FROM world_event").get() as { n: number }).n).toBe(1);
  });

  it("rejects an event for another organization", async () => {
    await expect(onEvent("sales_day", { org_id: "foreign" }, "SOURCE-2")).rejects.toMatchObject({ status: 404, code: "not_found" });
    expect((db().prepare("SELECT COUNT(*) AS n FROM world_event").get() as { n: number }).n).toBe(0);
  });

  it("shows persisted proposal and agent work after a run", async () => {
    db().prepare("INSERT INTO calc_run (id,started_at,skus,recommended) VALUES (?,?,?,?)").run("RUN-1", "2026-09-23T00:00:00Z", 1, 1);
    db().prepare("INSERT INTO proposal (id,kind,subject_id,created_at) VALUES (?,?,?,?)").run("PR-1", "supplier_order", "SE", "2026-09-23T00:00:00Z");
    db().prepare("INSERT INTO agent_run (id,org_id,trigger_type,started_at) VALUES (?,?,?,?)").run("AR-1", "partner", "calc_request", "2026-09-23T00:00:00Z");
    db().prepare("INSERT INTO agent_action (id,run_id,org_id,kind,summary_ru,at) VALUES (?,?,?,?,?,?)").run("AA-1", "AR-1", "partner", "recompute", "Пересчитано", "2026-09-23T00:00:00Z");
    const todayBody = await (await today()).json();
    const queueBody = await (await queue()).json();
    expect(todayBody.queue_count).toBe(1);
    expect(todayBody.pulse.agents.ratio).toBe(1);
    expect(todayBody.background).toHaveLength(1);
    expect(todayBody.commitments).toEqual([expect.objectContaining({ id: "PR-1", state: "needs_review" })]);
    expect(queueBody.items[0].title).toContain("SE");
  });

  it("keeps the pending explanation and no commitment for a zero recommendation run", async () => {
    db().prepare("INSERT INTO calc_run (id,started_at,skus,recommended) VALUES (?,?,?,?)")
      .run("RUN-ZERO", "2026-09-23T00:00:00Z", 0, 0);
    const body = await (await today()).json();
    expect(body.commitments).toEqual([]);
    expect(body.pending_reason).toContain("Нет предложений");
  });
});
