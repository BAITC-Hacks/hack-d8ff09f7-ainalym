import { afterAll, beforeAll, expect, it } from "vitest";
import { db, resetInstance } from "../../src/db/client";
import { runCalculation } from "../../src/domain/apply";
import { processEvent } from "../../src/ai/worker";

// Judge-sim P0: an affected-only recompute after a world event must carry the organisation scope,
// otherwise the visible supplier proposal keeps the old quantity and stays approvable.
const ORG = "DEMO-PARTNER-A";
const asOf = new Date().toISOString().slice(0, 10);
beforeAll(() => {
  resetInstance();
  const d = db();
  d.prepare("INSERT INTO organization(id,name) VALUES (?,'Партнёр A')").run(ORG);
  d.prepare("INSERT INTO supplier(id,name,lead_time_days) VALUES ('SE','System Electric',50)").run();
  d.prepare("INSERT INTO sku(code_1c,supplier_id,name,unit_cost) VALUES ('SE-A','SE','SE-A','12.50')").run();
  for (let month = 1; month <= 12; month++) {
    const ym = `2024-${String(month).padStart(2, "0")}`;
    d.prepare("INSERT INTO sales_month(code_1c,ym,qty_file) VALUES ('SE-A',?,'30')").run(ym);
    d.prepare("INSERT INTO sales_line(code_1c,doc_no,at,qty) VALUES ('SE-A',?,?,'30')").run(`SE-A-${ym}`, `${ym}-15`);
  }
  d.prepare("INSERT INTO stock_month(code_1c,ym,opening_qty) VALUES ('SE-A',?,'0')").run(asOf.slice(0, 7));
});
afterAll(() => resetInstance());

const visible = () => db().prepare("SELECT id,org_id,payload,version FROM proposal WHERE kind='supplier_order' AND subject_id='SE' AND state='needs_review' AND (org_id=? OR org_id IS NULL) ORDER BY created_at DESC,rowid DESC")
  .all(ORG) as { id: string; org_id: string; payload: string; version: number }[];
const qtyOf = (payload: string) => (JSON.parse(payload).lines as { code_1c: string; qty: number }[]).find(line => line.code_1c === "SE-A")?.qty;

it("M1-style event: the visible SE proposal shows the new quantity for the organisation, not the old one", async () => {
  const initial = await runCalculation({ supplier: "SE" }, {}, { as_of: asOf, org_id: ORG });
  const before = initial.proposals[0] as { id: string };
  const oldQty = qtyOf(visible()[0].payload)!;
  expect(oldQty).toBeGreaterThan(0);
  db().prepare(`INSERT INTO world_event(id,org_id,kind,code_1c,source_id,at,payload,state)
    VALUES ('WE-M1','${ORG}','in_transit_update','SE-A','TRANSIT-M1',?,?,'pending')`)
    .run(asOf, JSON.stringify({ code_1c: "SE-A", po_ref: "INBOUND-M1", qty: String(Math.max(1, Math.floor(oldQty / 2))) }));
  expect((await processEvent("WE-M1")).reason).toBeUndefined();
  const now = visible();
  expect(now).toHaveLength(1);
  expect(now[0].id).not.toBe(before.id);
  expect(now[0].org_id).toBe(ORG);
  expect(qtyOf(now[0].payload)).not.toBe(oldQty);
  expect(db().prepare("SELECT state FROM proposal WHERE id=?").get(before.id)).toEqual({ state: "stale" });
  expect(db().prepare("SELECT org_id FROM calc_run WHERE agent_run_id=(SELECT run_id FROM world_event WHERE id='WE-M1')").get()).toEqual({ org_id: ORG });
});
