import { afterEach, beforeEach, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { db, migrate, resetInstance, stateVersion } from "../../src/db/client";
import { GET } from "../../src/app/api/recommendations/[id]/route";
import { GET as listRecommendations } from "../../src/app/api/recommendations/route";
import { POST } from "../../src/app/api/recommendations/[id]/adjust/route";

const context = { params: Promise.resolve({ id: "REC-1" }) };
const request = (value: unknown) => new Request("http://localhost/api/recommendations/REC-1/adjust", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value),
});

beforeEach(() => {
  resetInstance();
  const database = db();
  database.prepare("INSERT INTO organization(id,name) VALUES ('partner','Partner')").run();
  database.prepare("INSERT INTO supplier(id,name,lead_time_days) VALUES ('SE','SE',50)").run();
  database.prepare("INSERT INTO sku(code_1c,supplier_id,name,unit_cost) VALUES ('SE-1','SE','Item 1','12.50')").run();
  database.prepare("INSERT INTO sku(code_1c,supplier_id,name,unit_cost) VALUES ('SE-2','SE','Item 2','2.00')").run();
  database.prepare("INSERT INTO agent_run(id,org_id,trigger_type,started_at) VALUES ('AR-1','partner','calc_request','2026-09-23')").run();
  database.prepare("INSERT INTO calc_run(id,started_at,agent_run_id) VALUES ('RUN-1','2026-09-23','AR-1')").run();
  database.prepare(`INSERT INTO proposal(id,kind,subject_type,subject_id,payload,money_at_stake,created_at)
    VALUES ('PR-1','supplier_order','supplier','SE',?,'{"amount":"145.00","currency":"KZT"}','2026-09-23')`)
    .run(JSON.stringify({ run_id: "RUN-1", supplier_id: "SE", lines: [
      { recommendation_id: "REC-1", code_1c: "SE-1", qty: 10, unit_cost: "12.50" },
      { recommendation_id: "REC-2", code_1c: "SE-2", qty: 10, unit_cost: "2.00" },
    ], cost_known_lines: 2 }));
  database.prepare("INSERT INTO recommendation(id,run_id,code_1c,supplier_id,qty_recommended,proposal_id,rationale_ru,components) VALUES ('REC-1','RUN-1','SE-1','SE',10,'PR-1','Need stock','{\"forecast_qty\":\"10\"}')").run();
  database.prepare("INSERT INTO recommendation(id,run_id,code_1c,supplier_id,qty_recommended,proposal_id) VALUES ('REC-2','RUN-1','SE-2','SE',10,'PR-1')").run();
});
afterEach(() => resetInstance());

it("GET returns one recommendation with rationale and components", async () => {
  const response = await GET(new Request("http://localhost/api/recommendations/REC-1"), context);
  expect(response.status).toBe(200);
  expect((await response.json()).recommendation).toMatchObject({ id: "REC-1", rationale_ru: "Need stock", components: { forecast_qty: "10" } });
});

it("list rows expose the version needed to submit an adjustment", async () => {
  const url = new Request("http://localhost/api/recommendations?run_id=RUN-1");
  const before = await listRecommendations(url);
  expect((await before.json()).groups[0].rows[0]).toMatchObject({ id: "REC-1", version: 1, state: "proposed", proposal_id: "PR-1" });
  await POST(request({ qty: 4, reason: "Supplier limit", version: 1 }), context);
  const after = await listRecommendations(url);
  expect((await after.json()).groups[0].rows[0]).toMatchObject({ id: "REC-1", version: 2, state: "adjusted" });
});

it("adjusts quantity and proposal totals, records one action, and bumps both versions and state once", async () => {
  const before = stateVersion();
  const response = await POST(request({ qty: 4, reason: "  Supplier limit  ", version: 1 }), context);
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result).toMatchObject({ ok: true, provenance: "partner_anonymised", recommendation: { id: "REC-1", qty_adjusted: 4,
    adjust_reason: "Supplier limit", version: 2 }, proposal: { id: "PR-1", version: 2 }, state_version: before + 1 });
  const proposal = db().prepare("SELECT payload,money_at_stake,version FROM proposal WHERE id='PR-1'").get() as { payload: string; money_at_stake: string; version: number };
  expect(JSON.parse(proposal.payload)).toMatchObject({ total_qty: 14, total_cost: { amount: "70.00", currency: "KZT" }, lines: [{ qty: 4 }, { qty: 10 }] });
  expect(JSON.parse(proposal.money_at_stake)).toEqual({ amount: "70.00", currency: "KZT" });
  expect(proposal.version).toBe(2);
  expect(db().prepare("SELECT kind,idempotency_key FROM agent_action WHERE subject_ref='REC-1'").all())
    .toEqual([{ kind: "recommendation_adjusted", idempotency_key: "recommendation:adjust:REC-1:2" }]);
  expect(stateVersion()).toBe(before + 1);
});

it("returns stale_version with the current version without another write", async () => {
  await POST(request({ qty: 4, reason: "First", version: 1 }), context);
  const before = stateVersion();
  const response = await POST(request({ qty: 5, reason: "Late", version: 1 }), context);
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: "stale_version", current_version: 2 });
  expect(stateVersion()).toBe(before);
  expect(db().prepare("SELECT COUNT(*) AS n FROM agent_action WHERE kind='recommendation_adjusted'").get()).toEqual({ n: 1 });
});

it("treats integer version zero as stale rather than an invalid body", async () => {
  const response = await POST(request({ qty: 4, reason: "Valid", version: 0 }), context);
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: "stale_version", current_version: 1 });
});

it("accepts zero quantity and keeps it on the single-row endpoint", async () => {
  const response = await POST(request({ qty: 0, reason: "Cancel this line", version: 1 }), context);
  expect(response.status).toBe(200);
  expect((await response.json()).recommendation).toMatchObject({ qty_adjusted: 0, version: 2 });
  const detail = await GET(new Request("http://localhost/api/recommendations/REC-1"), context);
  expect((await detail.json()).recommendation.qty_adjusted).toBe(0);
  expect(JSON.parse((db().prepare("SELECT money_at_stake FROM proposal WHERE id='PR-1'").get() as { money_at_stake: string }).money_at_stake))
    .toEqual({ amount: "20.00", currency: "KZT" });
});

it("creates a ledger run in the owning organization when the calculation has none", async () => {
  db().prepare("UPDATE calc_run SET agent_run_id=NULL WHERE id='RUN-1'").run();
  const before = stateVersion();
  const response = await POST(request({ qty: 4, reason: "Supplier limit", version: 1 }), context);
  expect(response.status).toBe(200);
  expect(stateVersion()).toBe(before + 1);
  expect(db().prepare("SELECT a.org_id,r.state FROM agent_action a JOIN agent_run r ON r.id=a.run_id WHERE a.kind='recommendation_adjusted'").get())
    .toEqual({ org_id: "partner", state: "done" });
});

it.each([
  { qty: -1, reason: "No", version: 1 },
  { qty: 1.5, reason: "No", version: 1 },
  { qty: 1, reason: " ", version: 1 },
  { qty: 1, reason: "x".repeat(201), version: 1 },
  { qty: 1, reason: "No", version: "1" },
])("rejects invalid body %#", async input => {
  const response = await POST(request(input), context);
  expect(response.status).toBe(400);
  expect((await response.json()).code).toBe("invalid_request");
});

it("returns 404 for an unknown recommendation", async () => {
  const unknown = { params: Promise.resolve({ id: "missing" }) };
  expect((await GET(new Request("http://localhost/api/recommendations/missing"), unknown)).status).toBe(404);
  expect((await POST(request({ qty: 1, reason: "Valid", version: 1 }), unknown)).status).toBe(404);
});

it("adds adjust_reason to an existing recommendation table", () => {
  const legacy = new DatabaseSync(":memory:");
  try {
    const schema = readFileSync("src/db/schema.sql", "utf8");
    legacy.exec(schema.replace("qty_adjusted INTEGER, adjust_reason TEXT,", "qty_adjusted INTEGER,"));
    expect((legacy.prepare("PRAGMA table_info(recommendation)").all() as { name: string }[]).some(column => column.name === "adjust_reason")).toBe(false);
    migrate(legacy);
    expect((legacy.prepare("PRAGMA table_info(recommendation)").all() as { name: string }[]).some(column => column.name === "adjust_reason")).toBe(true);
  } finally { legacy.close(); }
});
