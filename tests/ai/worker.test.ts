import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetInstance } from "../../src/db/client";
import { processEvent, tick } from "../../src/ai/worker";

const mocks = vi.hoisted(() => ({
  runNumber: 0,
  apply: vi.fn(),
  start: vi.fn(async () => `AR-TEST-${++mocks.runNumber}`),
  record: vi.fn(async (_run: string, _action: { kind: string; rationale_ru?: string }) => "AA-TEST"),
  finish: vi.fn(async () => {}),
}));
vi.mock("../../src/domain/events", () => ({ applyWorldEvent: mocks.apply }));
vi.mock("../../src/server/ledger", () => ({ startRun: mocks.start, recordAction: mocks.record, finishRun: mocks.finish }));

function seed(id: string, seq: number, kind = "stock_snapshot") {
  db().prepare(`INSERT INTO world_event(id,org_id,seq,kind,source_id,payload,state)
    VALUES (?, 'OWN', ?, ?, ?, '{}', 'pending')`).run(id, seq, kind, id);
}

beforeAll(() => { resetInstance(); });
beforeEach(() => {
  db().exec("DELETE FROM world_event; DELETE FROM task; DELETE FROM proposal; DELETE FROM decision_record");
  mocks.apply.mockReset();
  mocks.start.mockClear();
  mocks.record.mockClear();
  mocks.finish.mockClear();
  mocks.apply.mockResolvedValue({ applied: true, affected_codes: [], actions: [], escalations: [] });
});
afterAll(() => resetInstance());

describe("world event worker", () => {
  it("drains pending rows in sequence and never reruns processed rows", async () => {
    seed("WE-TWO", 2);
    seed("WE-ONE", 1);
    const first = await tick();
    expect(first.processed).toBe(2);
    expect(first.runs).toHaveLength(2);
    expect(mocks.apply.mock.calls.map(([row]) => row.id)).toEqual(["WE-ONE", "WE-TWO"]);
    expect((db().prepare("SELECT COUNT(DISTINCT run_id) AS n FROM world_event WHERE state='processed'").get() as { n: number }).n).toBe(2);
    expect((await tick()).processed).toBe(0);
    expect(mocks.apply).toHaveBeenCalledTimes(2);
    expect((await processEvent("WE-ONE")).reason).toBe("already_processed");
  });

  it("marks a failed event and records the reason for the ledger", async () => {
    seed("WE-BAD", 1, "unsupported_kind");
    mocks.apply.mockResolvedValueOnce({ applied: false, affected_codes: [], actions: [], escalations: [], reason: "unsupported_world_event" });
    const result = await processEvent("WE-BAD");
    expect(result.reason).toBe("unsupported_world_event");
    expect((db().prepare("SELECT state FROM world_event WHERE id='WE-BAD'").get() as { state: string }).state).toBe("failed");
    expect(mocks.record.mock.calls.some(([, action]) => action.kind === "escalation" && action.rationale_ru === "unsupported_world_event")).toBe(true);
    expect((await tick()).processed).toBe(0);
  });

  it("runs a due scheduled check once", async () => {
    db().prepare(`INSERT INTO task(id,title,state,next_event_at,updated_at)
      VALUES ('TK-DUE','Проверить срок','needs_review','2024-01-01T00:00:00Z','2024-01-01T00:00:00Z')`).run();
    const first = await tick();
    expect(first.processed).toBe(0);
    expect(first.runs).toHaveLength(1);
    expect(mocks.record.mock.calls.some(([, action]) => action.kind === "escalation")).toBe(true);
    expect((await tick()).runs).toHaveLength(0);
  });

  it("drains an event added while the tick is running", async () => {
    seed("WE-FIRST", 1);
    mocks.apply.mockImplementationOnce(async () => {
      seed("WE-LATER", 2);
      return { applied: true, affected_codes: [], actions: [], escalations: [] };
    });
    expect((await tick()).processed).toBe(2);
    expect(mocks.apply.mock.calls.map(([row]) => row.id)).toEqual(["WE-FIRST", "WE-LATER"]);
  });

  it("prepares an outlier review proposal for a borderline document", async () => {
    const previous = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = "rules";
    try {
      db().prepare(`INSERT INTO world_event(id,org_id,seq,kind,source_id,text,payload,state)
        VALUES ('WE-BORDER','OWN',1,'judge_message','BORDER','Разовый заказ',?,'pending')`)
        .run(JSON.stringify({ qty: 100, threshold: 100, doc_no: "DOC-BORDER" }));
      const result = await processEvent("WE-BORDER");
      expect(result.reason).toBeUndefined();
      const proposal = db().prepare("SELECT kind,state,payload FROM proposal WHERE subject_id='DOC-BORDER'")
        .get() as { kind: string; state: string; payload: string } | undefined;
      expect(proposal).toMatchObject({ kind: "outlier_review", state: "needs_review" });
      expect(JSON.parse(proposal!.payload).answer).toBe("one_off");
      expect(mocks.record.mock.calls.some(([, action]) => action.kind === "escalation")).toBe(true);
    } finally { if (previous === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = previous; }
  });
});
