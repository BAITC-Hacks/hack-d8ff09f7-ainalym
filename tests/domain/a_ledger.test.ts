import { afterEach, describe, expect, it } from "vitest";
import { db, resetInstance } from "../../src/db/client";
import { applyRecommendations, runCalculation } from "../../src/domain/apply";
import { queueView } from "../../src/domain/views";
import { createTask } from "../../src/domain/tasks";
import { runScheduledChecks } from "../../src/domain/schedule";

const oldPath = process.env.DATABASE_PATH;
afterEach(() => { resetInstance(); if (oldPath === undefined) delete process.env.DATABASE_PATH; else process.env.DATABASE_PATH = oldPath; });

function fixture() {
  resetInstance();
  process.env.DATABASE_PATH = ":memory:";
  const database = db();
  database.prepare("INSERT INTO organization (id,name,payload) VALUES ('ORG-1','Тест','{}')").run();
  database.prepare("INSERT INTO supplier (id,name,lead_time_days) VALUES ('SE','SE',50)").run();
  database.prepare("INSERT INTO sku (code_1c,supplier_id,name,unit_cost) VALUES ('SE-1','SE','Тест','1.00')").run();
  for (let month = 1; month <= 12; month++) {
    const ym = `2024-${String(month).padStart(2, "0")}`;
    database.prepare("INSERT INTO sales_month (code_1c,ym,qty_file) VALUES ('SE-1',?,'30')").run(ym);
  }
  database.prepare("INSERT INTO stock_month (code_1c,ym,opening_qty) VALUES ('SE-1','2024-12','0')").run();
  return database;
}

describe("agent loop ledger", () => {
  it("records sourced recompute, preparation and escalation once", async () => {
    const database = fixture();
    const result = await runCalculation({}, {}, { database, org_id: "ORG-1", as_of: "2025-01-01" });
    const actions = database.prepare("SELECT kind,sources,autonomy FROM agent_action ORDER BY at,id").all() as
      { kind: string; sources: string; autonomy: string }[];
    expect(actions.map((row) => row.kind)).toEqual(expect.arrayContaining(["recompute", "recommendation_prepared", "escalation"]));
    for (const action of actions) expect(JSON.parse(action.sources).length).toBeGreaterThan(0);
    expect(actions.find((row) => row.kind === "escalation")?.autonomy).toBe("escalated");
    expect((await queueView("ORG-1", database)).items[0].id).toBe(result.proposals[0].id);
    await applyRecommendations(result.run_id, { database, org_id: "ORG-1" });
    expect(database.prepare("SELECT count(*) AS n FROM agent_action").get()).toEqual({ n: actions.length });
  });

  it("escalates an overdue supplier task once per version", async () => {
    const database = fixture();
    await createTask({ title: "Ответ SE", state: "awaiting_supplier", next_event_at: "2025-01-01T00:00:00Z", sources: ["supplier:SE"] }, { database, org_id: "ORG-1" });
    const first = await runScheduledChecks("2025-01-02T00:00:00Z", { database, org_id: "ORG-1" });
    const count = (database.prepare("SELECT count(*) AS n FROM agent_action").get() as { n: number }).n;
    expect(first.proposals).toHaveLength(1);
    expect(database.prepare("SELECT kind,sources FROM agent_action WHERE subject_ref=?").get(first.proposals[0])).toEqual(expect.objectContaining({ kind: "escalation" }));
    await runScheduledChecks("2025-01-02T00:00:00Z", { database, org_id: "ORG-1" });
    expect(database.prepare("SELECT count(*) AS n FROM agent_action").get()).toEqual({ n: count });
  });
});
