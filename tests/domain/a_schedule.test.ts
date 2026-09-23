import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { migrate } from "../../src/db/client";
import { createTask, transitionTask } from "../../src/domain/tasks";
import { runScheduledChecks } from "../../src/domain/schedule";
import { runCalculation } from "../../src/domain/apply";

const fixture = () => { const database = new DatabaseSync(":memory:"); migrate(database); return database; };
function stockedFixture() {
  const database = fixture();
  database.prepare("INSERT INTO supplier (id,name,lead_time_days) VALUES ('SE','SE',40)").run();
  database.prepare("INSERT INTO sku (code_1c,supplier_id,name,unit_cost) VALUES ('SE-1','SE','Тест','1.00')").run();
  for (let month = 1; month <= 12; month++) {
    const ym = `2024-${String(month).padStart(2, "0")}`;
    database.prepare("INSERT INTO sales_month (code_1c,ym,qty_file) VALUES ('SE-1',?,'30')").run(ym);
  }
  database.prepare("INSERT INTO stock_month (code_1c,ym,opening_qty) VALUES ('SE-1','2024-12','0')").run();
  return database;
}

describe("task state and scheduled checks", () => {
  it("allows a valid versioned transition and reports affected rows", async () => {
    const database = fixture();
    const task = await createTask({ title: "Проверить", proposal_id: "PR-X" }, { database });
    const changed = await transitionTask(task.id, "needs_review", 1, { database });
    expect(changed).toEqual(expect.objectContaining({ state: "needs_review", version: 2, affected: { tasks: [task.id], proposals: ["PR-X"] } }));
  });

  it("rejects a stale task version and an invalid transition", async () => {
    const database = fixture();
    const task = await createTask({ title: "Проверить" }, { database });
    await expect(transitionTask(task.id, "needs_review", 2, { database })).rejects.toMatchObject({ status: 409 });
    await expect(transitionTask(task.id, "handed_over", 1, { database })).rejects.toThrow(/invalid task transition/);
  });

  it("creates one follow-up proposal for an overdue supplier task version", async () => {
    const database = fixture();
    const task = await createTask({ title: "Ответ IEK", state: "awaiting_supplier", next_event_at: "2025-01-01T00:00:00Z" }, { database });
    const first = await runScheduledChecks("2025-01-02T00:00:00Z", { database });
    const again = await runScheduledChecks("2025-01-02T00:00:00Z", { database });
    expect(first.proposals).toHaveLength(1);
    expect(again.processed).toBe(0);
    const proposal = database.prepare("SELECT kind,payload,state FROM proposal WHERE id=?").get(first.proposals[0]) as { kind: string; payload: string; state: string };
    expect(proposal.kind).toBe("clarification");
    expect(proposal.state).toBe("needs_review");
    expect(JSON.parse(proposal.payload)).toEqual(expect.objectContaining({ task_id: task.id, task_version: 1 }));
  });

  it("does not write on a quiet tick", async () => {
    const database = fixture();
    const version = database.prepare("SELECT n FROM state_version").get();
    const result = await runScheduledChecks("2025-01-02T00:00:00Z", { database });
    expect(result).toEqual({ runs: [], processed: 0, proposals: [], affected: [] });
    expect(database.prepare("SELECT n FROM state_version").get()).toEqual(version);
  });

  it("reflags only a SKU whose cover crosses its lead time", async () => {
    const database = stockedFixture();
    await runCalculation({}, {}, { database, as_of: "2025-01-01" });
    const rec = database.prepare("SELECT id,components FROM recommendation").get() as { id: string; components: string };
    const components = { ...JSON.parse(rec.components), days_of_cover: 45 };
    database.prepare("UPDATE recommendation SET urgency='soon',components=? WHERE id=?").run(JSON.stringify(components), rec.id);
    database.prepare("UPDATE calc_run SET finished_at='2025-01-01T00:00:00Z'").run();
    const result = await runScheduledChecks("2025-01-07T00:00:00Z", { database });
    expect(result.affected).toEqual(["SE-1"]);
    expect(database.prepare("SELECT urgency FROM recommendation WHERE id=?").get(rec.id)).toEqual({ urgency: "critical" });
    expect((await runScheduledChecks("2025-01-07T00:00:00Z", { database })).processed).toBe(0);
  });

  it("recomputes a SKU once after a newer processed sales day", async () => {
    const database = stockedFixture();
    await runCalculation({}, {}, { database, as_of: "2025-01-01" });
    database.prepare("INSERT INTO world_event (id,org_id,kind,code_1c,source_id,state,processed_at) VALUES ('WE-1','ORG-1','sales_day','SE-1','SRC-1','processed','2026-09-24T00:00:00Z')").run();
    const first = await runScheduledChecks("2026-09-25T00:00:00Z", { database });
    expect(first.affected).toEqual(["SE-1"]);
    expect(first.runs).toHaveLength(2);
    expect((await runScheduledChecks("2026-09-25T00:00:00Z", { database })).processed).toBe(0);
  });
});
