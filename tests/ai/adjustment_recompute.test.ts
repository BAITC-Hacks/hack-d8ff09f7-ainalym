import { afterAll, beforeAll, expect, it } from "vitest";
import { db, resetInstance } from "../../src/db/client";
import { adjustRecommendation, runCalculation } from "../../src/domain/apply";
import { processEvent } from "../../src/ai/worker";
import { GET as getRecommendations } from "../../src/app/api/recommendations/route";
import { GET as getRecommendation } from "../../src/app/api/recommendations/[id]/route";

const asOf = new Date().toISOString().slice(0, 10);

beforeAll(() => {
  resetInstance();
  const d = db();
  d.prepare("INSERT INTO supplier(id,name,lead_time_days,review_days) VALUES ('SE','System Electric',50,30)").run();
  d.prepare("INSERT INTO sku(code_1c,supplier_id,name,moq,unit,unit_cost) VALUES ('ADJUST-1','SE','Проверка корректировки',6,'шт','1')").run();
  for (let month = 1; month <= 12; month++) {
    const ym = `2024-${String(month).padStart(2, "0")}`;
    d.prepare("INSERT INTO sales_month(code_1c,ym,qty_file) VALUES ('ADJUST-1',?,'46.5')").run(ym);
    d.prepare("INSERT INTO sales_line(code_1c,doc_no,at,qty) VALUES ('ADJUST-1',?,?,'46.5')").run(`DOC-${ym}`, `${ym}-15`);
  }
  d.prepare("INSERT INTO stock_month(code_1c,ym,opening_qty) VALUES ('ADJUST-1',?,'0')").run(asOf.slice(0, 7));
});
afterAll(() => resetInstance());

it("keeps a 132 шт adjustment when +100 in transit changes 126 → 24, with ledger and API review flag", async () => {
  const initial = await runCalculation({ codes: ["ADJUST-1"] }, {}, { as_of: asOf });
  const original = db().prepare("SELECT id,qty_recommended,version FROM recommendation WHERE run_id=?").get(initial.run_id) as
    { id: string; qty_recommended: number; version: number };
  expect(original.qty_recommended).toBe(126);
  const adjusted = await adjustRecommendation(original.id, 132, "Объект клиента", original.version);
  db().prepare(`INSERT INTO world_event(id,org_id,kind,code_1c,source_id,at,payload,state)
    VALUES ('WE-ADJUST','ORG-1','in_transit_update','ADJUST-1','TRANSIT-ADJUST',?,?,'pending')`)
    .run(asOf, JSON.stringify({ code_1c: "ADJUST-1", po_ref: "INBOUND-ADJUST", qty: "100" }));
  expect((await processEvent("WE-ADJUST")).reason).toBeUndefined();
  const rec = db().prepare("SELECT id,qty_recommended,qty_adjusted,adjust_reason,state,version,proposal_id FROM recommendation WHERE code_1c='ADJUST-1' ORDER BY rowid DESC LIMIT 1")
    .get() as { id: string; qty_recommended: number; qty_adjusted: number; adjust_reason: string; state: string; version: number; proposal_id: string };
  expect(rec).toMatchObject({ qty_recommended: 24, qty_adjusted: 132, adjust_reason: "Объект клиента", state: "adjusted", version: adjusted.version + 1 });
  const proposal = db().prepare("SELECT payload,supersedes_id FROM proposal WHERE id=?").get(rec.proposal_id) as { payload: string; supersedes_id: string };
  expect(proposal.supersedes_id).toBe(adjusted.proposal_id);
  expect(JSON.parse(proposal.payload).lines).toEqual([expect.objectContaining({ recommendation_id: rec.id, qty: 132, adjust_reason: "Объект клиента", needs_review: true })]);
  const ledger = db().prepare("SELECT summary_ru FROM agent_action WHERE world_event_id='WE-ADJUST' AND kind='recommendation_adjustment_carried'").get() as { summary_ru: string };
  expect(ledger.summary_ru).toBe("Корректировка 132 шт сохранена; после события расчёт изменил рекомендацию 126 → 24 — проверьте");
  const response = await getRecommendations(new Request("http://localhost/api/recommendations?supplier=SE"));
  expect(response.status).toBe(200);
  const body = await response.json() as { groups: { rows: { id: string; qty_adjusted: number; adjust_reason: string; needs_review: boolean }[] }[] };
  expect(body.groups.flatMap(group => group.rows)).toEqual([expect.objectContaining({ id: rec.id, qty_adjusted: 132, adjust_reason: "Объект клиента", needs_review: true })]);
  const detail = await getRecommendation(new Request(`http://localhost/api/recommendations/${rec.id}`), { params: Promise.resolve({ id: rec.id }) });
  expect((await detail.json()).recommendation).toEqual(expect.objectContaining({ id: rec.id, qty_adjusted: 132, needs_review: true }));
});
