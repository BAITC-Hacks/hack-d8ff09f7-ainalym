import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, resetInstance } from "../../src/db/client";
import { tick } from "../../src/ai/worker";
import { startRun } from "../../src/server/ledger";
import { applyWorldEvent } from "../../src/domain/events";

beforeAll(() => {
  resetInstance();
  const d = db();
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  d.prepare("INSERT INTO organization(id,name) VALUES ('OWN','Test organization')").run();
  d.prepare("INSERT INTO supplier(id,name,lead_time_days) VALUES ('SE','System Electric',50)").run();
  d.prepare("INSERT INTO sku(code_1c,supplier_id,name,unit_cost,moq) VALUES ('SE-ONE','SE','Выключатель','12.50',1)").run();
  for (let month = 11; month >= 0; month--) {
    const date = new Date();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - month);
    const ym = date.toISOString().slice(0, 7);
    d.prepare("INSERT INTO sales_month(code_1c,ym,qty_file) VALUES ('SE-ONE',?,'30')").run(ym);
    d.prepare("INSERT INTO sales_line(code_1c,doc_no,at,qty) VALUES ('SE-ONE',?,?,'30')").run(`DOC-${ym}`, `${ym}-15`);
  }
  d.prepare("INSERT INTO stock_month(code_1c,ym,opening_qty) VALUES ('SE-ONE',?,'0')").run(currentMonth);
  d.prepare(`INSERT INTO world_event(id,org_id,seq,kind,code_1c,source_id,at,payload,state)
    VALUES ('WE-TRANSIT','OWN',1,'in_transit_update','SE-ONE','TRANSIT-1',? ,?,'pending')`)
    .run(today, JSON.stringify({ code_1c: "SE-ONE", po_ref: "INBOUND-1", qty: "10" }));
  d.prepare(`INSERT INTO world_event(id,org_id,seq,kind,code_1c,source_id,at,payload,state)
    VALUES ('WE-SALES','OWN',2,'sales_day','SE-ONE','SALES-1',?,?,'pending')`)
    .run(today, JSON.stringify({ lines: [{ code_1c: "SE-ONE", doc_no: "DOC-NEW", qty: "20", at: today }] }));
});
afterAll(() => resetInstance());

describe("worker with replenishment domains", () => {
  it("applies, recomputes, and proposes from two events without replaying", async () => {
    const first = await tick();
    expect(first.processed).toBe(2);
    expect((db().prepare("SELECT COUNT(*) AS n FROM world_event WHERE state='processed'").get() as { n: number }).n).toBe(2);
    expect((db().prepare("SELECT COUNT(*) AS n FROM calc_run").get() as { n: number }).n).toBe(2);
    expect((db().prepare("SELECT COUNT(*) AS n FROM proposal WHERE kind='supplier_order'").get() as { n: number }).n).toBe(2);
    expect((db().prepare("SELECT COUNT(*) AS n FROM agent_run WHERE trigger_type='world_event' AND state='done'").get() as { n: number }).n).toBe(2);
    expect((db().prepare("SELECT COUNT(*) AS n FROM agent_run WHERE trigger_type='calc_request'").get() as { n: number }).n).toBe(0);
    expect((db().prepare("SELECT COUNT(*) AS n FROM agent_action WHERE kind='recompute' AND world_event_id IS NOT NULL").get() as { n: number }).n).toBeGreaterThanOrEqual(2);
    expect((db().prepare("SELECT COUNT(*) AS n FROM agent_action WHERE world_event_id IS NOT NULL").get() as { n: number }).n).toBeGreaterThan(2);
    const workerActions = db().prepare("SELECT idempotency_key FROM agent_action WHERE idempotency_key LIKE 'worker:%:recompute:%'").all() as { idempotency_key: string }[];
    expect(workerActions).toHaveLength(2);
    expect(new Set(workerActions.map(row => row.idempotency_key)).size).toBe(2);
    expect((await tick()).processed).toBe(0);
    expect((db().prepare("SELECT COUNT(*) AS n FROM calc_run").get() as { n: number }).n).toBe(2);
  });
  it("reclaims an interrupted applied event without applying its source twice", async () => {
    const oldRun = await startRun({ org_id: "OWN", trigger_type: "world_event", trigger_ref: "WE-STALE" });
    const payload = JSON.stringify({ code_1c: "SE-ONE", po_ref: "INBOUND-STALE", qty: "10" });
    db().prepare(`INSERT INTO world_event(id,org_id,seq,kind,code_1c,source_id,at,payload,state,run_id,claimed_at,attempt)
      VALUES ('WE-STALE','OWN',3,'in_transit_update','SE-ONE','TRANSIT-STALE','2025-01-03',?,'pending',?,'2020-01-01T00:00:00.000Z',1)`)
      .run(payload, oldRun);
    await applyWorldEvent({ id: "WE-STALE", kind: "in_transit_update", org_id: "OWN", code_1c: "SE-ONE",
      source_id: "TRANSIT-STALE", payload, run_id: oldRun, at: "2025-01-03" });
    expect(db().prepare("SELECT state FROM world_event WHERE id='WE-STALE'").get()).toEqual({ state: "pending" });
    expect((await tick()).processed).toBe(1);
    expect(db().prepare("SELECT state,attempt FROM world_event WHERE id='WE-STALE'").get()).toEqual({ state: "processed", attempt: 2 });
    expect(db().prepare("SELECT state FROM agent_run WHERE id=?").get(oldRun)).toEqual({ state: "failed" });
    expect((db().prepare("SELECT COUNT(*) AS n FROM in_transit WHERE po_ref='INBOUND-STALE'").get() as { n: number }).n).toBe(1);
  });
});
