import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { db, resetInstance, stateVersion, withTx } from "../../src/db/client";
import { repo } from "../../src/db/repo";
import { finishRun, recordAction, startRun } from "../../src/server/ledger";

describe("repository and ledger persistence", () => {
  beforeEach(() => { resetInstance(); db(); });
  afterEach(() => resetInstance());

  it("increments row version and state_version in one update", () => {
    const suppliers = repo("supplier");
    suppliers.insert({ id: "SE", name: "SE", lead_time_days: 50 });
    const before = stateVersion();
    const updated = suppliers.update("SE", { lead_time_days: 55 });
    expect(updated?.version).toBe(2);
    expect(updated?.lead_time_days).toBe(55);
    expect(stateVersion()).toBe(before + 1);
    expect(suppliers.get("SE")?.lead_time_days).toBe(55);
  });

  it("deduplicates an action key without another write", async () => {
    const run = await startRun({ org_id: "partner", trigger_type: "calc_request", trigger_ref: "RUN-1" });
    const action = { kind: "recompute", subject_ref: "SKU-1", summary_ru: "Пересчёт", sources: ["sku:SKU-1"], idempotency_key: "recompute:RUN-1:SKU-1" };
    const first = await recordAction(run, action);
    const beforeReplay = stateVersion();
    expect(await recordAction(run, action)).toBe(first);
    expect(stateVersion()).toBe(beforeReplay);
    await finishRun(run, "done");
    expect((db().prepare("SELECT COUNT(*) AS n FROM agent_action").get() as { n: number }).n).toBe(1);
    expect(db().prepare("SELECT state,actions_count FROM agent_run WHERE id=?").get(run)).toEqual({ state: "done", actions_count: 1 });
  });

  it("rolls back a run and its actions after an injected failure", () => {
    expect(() => withTx(tx => {
      const run = startRun({ org_id: "partner", trigger_type: "calc_request" }, tx);
      expect(typeof run).toBe("string");
      recordAction(run, { kind: "recompute", summary_ru: "Пересчёт" }, tx);
      throw new Error("injected failure");
    })).toThrow("injected failure");
    expect(db().prepare("SELECT COUNT(*) AS n FROM agent_run").get()).toEqual({ n: 0 });
    expect(db().prepare("SELECT COUNT(*) AS n FROM agent_action").get()).toEqual({ n: 0 });
  });

  it("rejects a Promise transaction and rolls back its synchronous writes", () => {
    expect(() => withTx(async tx => {
      const run = startRun({ org_id: "partner", trigger_type: "calc_request" }, tx);
      recordAction(run, { kind: "recompute", summary_ru: "Пересчёт" }, tx);
    })).toThrow("synchronous callback");
    expect(db().prepare("SELECT COUNT(*) AS n FROM agent_run").get()).toEqual({ n: 0 });
    expect(db().prepare("SELECT COUNT(*) AS n FROM agent_action").get()).toEqual({ n: 0 });
  });
});
