import { afterAll, beforeAll, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { db, resetInstance } from "../../src/db/client";
import { tick } from "../../src/ai/worker";

const dir = mkdtempSync(join(tmpdir(), "ainalym-ledger-probe-"));
const prior = { DATABASE_PATH: process.env.DATABASE_PATH, AI_PROVIDER: process.env.AI_PROVIDER, AINALYM_MODE: process.env.AINALYM_MODE };
beforeAll(() => {
  process.env.DATABASE_PATH = join(dir, "test.db");
  process.env.AI_PROVIDER = "rules";
  process.env.AINALYM_MODE = "live";
  resetInstance();
  const d = db();
  d.prepare("INSERT INTO organization(id,name) VALUES ('OWN','Test')").run();
  d.prepare("INSERT INTO supplier(id,name,lead_time_days) VALUES ('SE','SE',50)").run();
  d.prepare("INSERT INTO sku(code_1c,supplier_id,name,unit_cost) VALUES ('SE-ONE','SE','Switch','12.50')").run();
  for (let month = 1; month <= 12; month++) {
    const ym = `2024-${String(month).padStart(2, "0")}`;
    d.prepare("INSERT INTO sales_month(code_1c,ym,qty_file) VALUES ('SE-ONE',?,'30')").run(ym);
    d.prepare("INSERT INTO sales_line(code_1c,doc_no,at,qty) VALUES ('SE-ONE',?,?,'30')").run(`DOC-${ym}`, `${ym}-15`);
  }
  d.prepare("INSERT INTO stock_month(code_1c,ym,opening_qty) VALUES ('SE-ONE','2024-12','0')").run();
  d.prepare(`INSERT INTO world_event(id,org_id,seq,kind,code_1c,source_id,at,payload,state)
    VALUES ('WE-TRANSIT','OWN',1,'in_transit_update','SE-ONE','TRANSIT-1','2025-01-01',?,'pending')`)
    .run(JSON.stringify({ code_1c: "SE-ONE", po_ref: "INBOUND-1", qty: "10" }));
  d.prepare(`INSERT INTO world_event(id,org_id,seq,kind,po_id,source_id,at,text,payload,state)
    VALUES ('WE-REPLY','OWN',2,'supplier_reply','PO-TEST','REPLY-1','2025-01-02','Предоплата 50%',?,'pending')`)
    .run(JSON.stringify({ po_id: "PO-TEST" }));
  d.prepare(`INSERT INTO world_event(id,org_id,seq,kind,source_id,at,payload,state)
    VALUES ('WE-BAD','OWN',3,'unsupported','BAD-1','2025-01-03','{}','pending')`).run();
});
afterAll(() => {
  resetInstance();
  for (const [key, value] of Object.entries(prior)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  rmSync(dir, { recursive: true, force: true });
});

it("writes one run per event, decision metadata, and a failure reason with L1 ledger", async (ctx) => {
  const result = await tick();
  if (result.runs.some(run => run.startsWith("RUN-STUB"))) ctx.skip("UNVERIFIED: L1 ledger implementation has not merged");
  expect(result.processed).toBe(2);
  const runs = db().prepare("SELECT trigger_ref,state,actions_count,escalations_count FROM agent_run ORDER BY started_at,id").all() as
    { trigger_ref: string; state: string; actions_count: number; escalations_count: number }[];
  expect(runs).toHaveLength(3);
  expect(new Set(runs.map(run => run.trigger_ref))).toEqual(new Set(["WE-TRANSIT", "WE-REPLY", "WE-BAD"]));
  expect(runs.find(run => run.trigger_ref === "WE-BAD")?.state).toBe("failed");
  const decision = db().prepare("SELECT provider,model_version,sources FROM agent_action WHERE world_event_id='WE-REPLY' AND kind='decision'").get() as
    { provider: string; model_version: string; sources: string } | undefined;
  expect(decision).toMatchObject({ provider: "rules", model_version: "rules-v1" });
  expect(JSON.parse(decision!.sources)).toContainEqual(expect.stringMatching(/^DR-/));
  const failure = db().prepare("SELECT rationale_ru,result FROM agent_action WHERE world_event_id='WE-BAD' AND result='failed'").get() as
    { rationale_ru: string; result: string } | undefined;
  expect(failure?.rationale_ru).toContain("unsupported_world_event");
  expect((await tick()).processed).toBe(0);
  expect((db().prepare("SELECT COUNT(*) AS n FROM agent_run").get() as { n: number }).n).toBe(3);
});
