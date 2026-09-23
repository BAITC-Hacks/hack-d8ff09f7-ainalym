import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { migrate } from "../../src/db/client";
import { applyRecommendations, runCalculation } from "../../src/domain/apply";

function fixture() {
  const database = new DatabaseSync(":memory:");
  migrate(database);
  database.prepare("INSERT INTO supplier (id,name,lead_time_days) VALUES ('SE','SE',50)").run();
  database.prepare("INSERT INTO sku (code_1c,supplier_id,name,unit_cost,moq) VALUES ('CODE-1','SE','Деталь','12.50',5)").run();
  for (let month = 1; month <= 12; month++) {
    const ym = `2024-${String(month).padStart(2, "0")}`;
    database.prepare("INSERT INTO sales_month (code_1c,ym,qty_file) VALUES ('CODE-1',?,'30')").run(ym);
    database.prepare("INSERT INTO sales_line (code_1c,doc_no,at,qty) VALUES ('CODE-1',?,?,'30')").run(`DOC-${ym}`, `${ym}-15`);
  }
  database.prepare("INSERT INTO stock_month (code_1c,ym,opening_qty) VALUES ('CODE-1','2024-12','0')").run();
  return database;
}

describe("calculation to supplier approval", () => {
  it("persists the forecast, recommendation, proposal and review task", async () => {
    const database = fixture();
    const result = await runCalculation({ supplier: "SE" }, {}, { database, as_of: "2025-01-01" });
    expect(result.recommended).toBe(1);
    expect(result.proposals).toHaveLength(1);
    expect(result.tasks).toHaveLength(1);
    expect(database.prepare("SELECT count(*) AS n FROM forecast").get()).toEqual({ n: 1 });
    const row = database.prepare("SELECT payload,money_at_stake,state FROM proposal").get() as { payload: string; money_at_stake: string; state: string };
    expect(row.state).toBe("needs_review");
    expect(JSON.parse(row.payload).lines[0]).toEqual(expect.objectContaining({ code_1c: "CODE-1", unit_cost: "12.50" }));
    expect(JSON.parse(row.money_at_stake)).toEqual(expect.objectContaining({ currency: "KZT" }));
  });

  it("replays an existing run without writing another proposal", async () => {
    const database = fixture();
    const result = await runCalculation({}, {}, { database, as_of: "2025-01-01" });
    const replay = await applyRecommendations(result.run_id, { database });
    expect(replay.proposals).toHaveLength(1);
    expect(database.prepare("SELECT count(*) AS n FROM proposal").get()).toEqual({ n: 1 });
  });

  it("marks an unapproved proposal stale when a newer run supersedes it", async () => {
    const database = fixture();
    const first = await runCalculation({}, {}, { database, as_of: "2025-01-01" });
    const next = await runCalculation({}, {}, { database, as_of: "2025-01-02" });
    const oldId = first.proposals[0].id;
    expect(database.prepare("SELECT state FROM proposal WHERE id=?").get(oldId as string)).toEqual({ state: "stale" });
    expect(next.proposals[0].supersedes_id).toBe(oldId);
  });
});
