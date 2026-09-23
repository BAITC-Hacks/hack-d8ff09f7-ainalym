import { afterAll, beforeAll, expect, it } from "vitest";
import { db, resetInstance } from "../../src/db/client";
import { runCalculation } from "../../src/domain/apply";
import { processEvent } from "../../src/ai/worker";
import { DatabaseSync } from "node:sqlite";
import { migrate } from "../../src/db/client";
import { applyRecommendations } from "../../src/domain/apply";

const asOf = new Date().toISOString().slice(0, 10);
beforeAll(() => {
  resetInstance();
  const d = db();
  d.prepare("INSERT INTO supplier(id,name,lead_time_days) VALUES ('SE','System Electric',50)").run();
  for (const code of ["SE-A", "SE-B"]) {
    d.prepare("INSERT INTO sku(code_1c,supplier_id,name,unit_cost) VALUES (?,'SE',?,'12.50')").run(code, code);
    for (let month = 1; month <= 12; month++) {
      const ym = `2024-${String(month).padStart(2, "0")}`;
      d.prepare("INSERT INTO sales_month(code_1c,ym,qty_file) VALUES (?,?,'30')").run(code, ym);
      d.prepare("INSERT INTO sales_line(code_1c,doc_no,at,qty) VALUES (?,?,?,'30')").run(code, `${code}-${ym}`, `${ym}-15`);
    }
    d.prepare("INSERT INTO stock_month(code_1c,ym,opening_qty) VALUES (?,?,'0')").run(code, asOf.slice(0, 7));
  }
});

it("does not create an empty supplier proposal for zero need", async () => {
  const database = new DatabaseSync(":memory:");
  try {
    migrate(database);
    database.prepare("INSERT INTO supplier(id,name,lead_time_days) VALUES ('ZERO','Zero',50)").run();
    database.prepare("INSERT INTO sku(code_1c,supplier_id,name) VALUES ('ZERO-1','ZERO','Inactive')").run();
    database.prepare("INSERT INTO calc_run(id,started_at,finished_at) VALUES ('RUN-ZERO','2025-01-01','2025-01-01')").run();
    database.prepare("INSERT INTO recommendation(id,run_id,code_1c,supplier_id,qty_recommended) VALUES ('REC-ZERO','RUN-ZERO','ZERO-1','ZERO',0)").run();
    expect((await applyRecommendations("RUN-ZERO", { database })).proposals).toHaveLength(0);
  } finally { database.close(); }
});
afterAll(() => resetInstance());

it("carries unchanged supplier lines with their rationale into a partial recompute proposal", async () => {
  const initial = await runCalculation({ supplier: "SE" }, {}, { as_of: asOf });
  const before = initial.proposals[0] as { id: string; payload: string };
  const oldLines = JSON.parse(before.payload).lines as Array<{ code_1c: string; recommendation_id: string }>;
  db().prepare(`INSERT INTO world_event(id,org_id,kind,code_1c,source_id,at,payload,state)
    VALUES ('WE-B','ORG-1','in_transit_update','SE-B','TRANSIT-B',?,?,'pending')`)
    .run(asOf, JSON.stringify({ code_1c: "SE-B", po_ref: "INBOUND-B", qty: "10" }));
  expect((await processEvent("WE-B")).reason).toBeUndefined();
  const next = db().prepare("SELECT * FROM proposal WHERE kind='supplier_order' AND state='needs_review' AND subject_id='SE'").get() as { payload: string; supersedes_id: string; version: number };
  const lines = JSON.parse(next.payload).lines as typeof oldLines;
  expect(next.supersedes_id).toBe(before.id);
  expect(next.version).toBe(2);
  expect(lines).toHaveLength(2);
  expect(lines.find(line => line.code_1c === "SE-A")).toEqual(oldLines.find(line => line.code_1c === "SE-A"));
  expect(lines.find(line => line.code_1c === "SE-B")?.recommendation_id).not.toBe(oldLines.find(line => line.code_1c === "SE-B")?.recommendation_id);
});
