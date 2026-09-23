import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetInstance, stateVersion } from "../../src/db/client";
import { processEvent, tick } from "../../src/ai/worker";
import { composeEvent } from "../../src/world/compose";
import { feed } from "../../src/world/feed";
import { play } from "../../src/world/play";
import { POST as composeRoute } from "../../src/app/api/world/compose/route";

vi.mock("../../src/ai/worker", () => ({
  tick: vi.fn(async () => ({ runs: [], processed: 0 })),
  processEvent: vi.fn(async () => ({ run_id: null, actions: 0, escalations: 0, reason: "noop" })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DATABASE_PATH = ":memory:";
  resetInstance();
  db().prepare("INSERT INTO organization (id, name) VALUES (?, ?)").run("ORG-TEST", "Test partner");
  db().prepare("INSERT INTO supplier (id,name,lead_time_days) VALUES (?,?,?)").run("IEK", "IEK", 40);
  db().prepare("INSERT INTO sku (code_1c,supplier_id,name) VALUES (?,?,?)").run("010500008_", "IEK", "ETL one-off SKU");
});
afterEach(() => resetInstance());

describe("world feed", () => {
  it("plays scripted rows in sequence through the worker seam", async () => {
    const d = db();
    for (const [id, seq] of [["WE-2", 2], ["WE-1", 1]] as const) {
      d.prepare("INSERT INTO world_event (id,org_id,seq,kind,source_id,text,state) VALUES (?,?,?,?,?,?,?)")
        .run(id, "ORG-TEST", seq, "sales_day", id, id, "scripted");
    }
    const result = await play({ steps: 1 });
    expect(result.emitted.map((row) => row.id)).toEqual(["WE-1"]);
    expect(result.emitted[0].emitted_at).toBeTruthy();
    expect(result.emitted[0].state).toBe("pending");
    expect(result.processed).toBe(0); // L3's current worker stub returns noop.
    expect(tick).toHaveBeenCalledExactlyOnceWith("ORG-TEST");
    expect(processEvent).not.toHaveBeenCalled();
    expect(feed({}).rows.map((row) => row.state)).toEqual(["pending", "scripted"]);
  });

  it("composes verbatim, deduplicates, and labels a synthetic event", async () => {
    const input = { kind: "judge_message" as const, actor_id: "judge", code_1c: "010500008_", text: "Разовый заказ 500 шт" };
    const first = await composeEvent(input);
    const version = stateVersion();
    const second = await composeEvent(input);
    expect(first.event.text).toBe(input.text);
    expect(first.event.label).toBe("Симулятор мира — синтетическое событие");
    expect(second.replayed).toBe(true);
    expect(second.event.id).toBe(first.event.id);
    expect(processEvent).toHaveBeenCalledExactlyOnceWith(first.event.id);
    expect(tick).not.toHaveBeenCalled();
    expect(second.state_version).toBe(version);
    expect(stateVersion()).toBe(version);
    expect(db().prepare("SELECT COUNT(*) AS n FROM world_event").get()).toMatchObject({ n: 1 });
  });

  it("does not disclose a foreign organization's rows", () => {
    db().prepare("INSERT INTO organization (id,name) VALUES (?,?)").run("ORG-OTHER", "Other");
    db().prepare("INSERT INTO world_event (id,org_id,kind,source_id,state) VALUES (?,?,?,?,?)")
      .run("WE-OTHER", "ORG-OTHER", "judge_message", "other", "pending");
    expect(feed({}).rows).toEqual([]);
    expect(() => feed({ org_id: "ORG-OTHER" })).toThrow("unknown_org");
  });

  it("uses the scripted demo org when ETL has not inserted an organization row", () => {
    db().prepare("DELETE FROM organization").run();
    db().prepare("INSERT INTO world_event (id,org_id,seq,kind,source_id,state) VALUES (?,?,?,?,?,?)")
      .run("WE-1", "partner", 1, "sales_day", "SALES-1", "scripted");
    expect(feed({}).rows[0].org_id).toBe("partner");
    expect(() => feed({ org_id: "foreign" })).toThrow("unknown_org");
  });

  it("keeps supplier replies inside the stateful supplier channel", async () => {
    const response = await composeRoute(new Request("http://localhost/api/world/compose", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "supplier_reply", po_id: "PO-FAKE", text: "Confirmed" }),
    }));
    expect(response.status).toBe(403);
    expect(db().prepare("SELECT COUNT(*) AS n FROM world_event").get()).toMatchObject({ n: 0 });
  });
});
