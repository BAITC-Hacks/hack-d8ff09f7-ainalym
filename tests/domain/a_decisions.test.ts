import { afterEach, describe, expect, it } from "vitest";
import { db, resetInstance } from "../../src/db/client";
import { adjustRecommendation, runCalculation } from "../../src/domain/apply";
import { queueView, todayView } from "../../src/domain/views";
import { POST as approve } from "../../src/app/api/proposals/[id]/approve/route";
import { approveOrder } from "../../src/domain/orders";

const oldPath = process.env.DATABASE_PATH;
afterEach(() => { resetInstance(); if (oldPath === undefined) delete process.env.DATABASE_PATH; else process.env.DATABASE_PATH = oldPath; });

function fixture(withOrg = true) {
  resetInstance();
  process.env.DATABASE_PATH = ":memory:";
  const database = db();
  if (withOrg) database.prepare("INSERT INTO organization (id,name,payload) VALUES ('ORG-1','Тест','{}')").run();
  database.prepare("INSERT INTO supplier (id,name,lead_time_days) VALUES ('SE','SE',50)").run();
  database.prepare("INSERT INTO sku (code_1c,supplier_id,name,unit_cost,moq) VALUES ('CODE-1','SE','Деталь','12.50',1)").run();
  for (let month = 1; month <= 12; month++) {
    const ym = `2024-${String(month).padStart(2, "0")}`;
    database.prepare("INSERT INTO sales_month (code_1c,ym,qty_file) VALUES ('CODE-1',?,'30')").run(ym);
    database.prepare("INSERT INTO sales_line (code_1c,doc_no,at,qty) VALUES ('CODE-1',?,?,'30')").run(`DOC-${ym}`, `${ym}-15`);
  }
  database.prepare("INSERT INTO stock_month (code_1c,ym,opening_qty) VALUES ('CODE-1','2024-12','0')").run();
  return database;
}

const post = (id: string, proposal_version: number) => approve(new Request(`http://localhost/api/proposals/${id}/approve`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proposal_version }),
}), { params: Promise.resolve({ id }) });

describe("review queue and versioned approval", () => {
  it("keeps today readable before the organization opening balance is loaded", async () => {
    const database = fixture(false);
    const today = await todayView("ORG-1", database);
    expect(today.lead).toBeTruthy();
    expect((today.pulse as { money: { empty_reason: string } }).money.empty_reason).toBe("organization_not_found");
  });
  it("shows one decision with rationale, sources and two effects", async () => {
    const database = fixture();
    await runCalculation({}, {}, { database, as_of: "2025-01-01" });
    const queue = await queueView("ORG-1", database);
    const today = await todayView("ORG-1", database);
    expect(queue.items).toHaveLength(1);
    expect(queue.items[0]).toEqual(expect.objectContaining({ kind: "proposal", sources: expect.any(Array), options: expect.any(Array) }));
    expect(queue.items[0].why.length).toBeGreaterThan(0);
    expect(queue.items[0].options).toHaveLength(2);
    expect(today.decision).toEqual(queue.items[0]);
    expect(today.lead).toBeTruthy();
  });

  it("returns 409 for stale version and prepares a local order for the exact current version", async () => {
    const database = fixture();
    const result = await runCalculation({}, {}, { database, as_of: "2025-01-01" });
    const id = result.proposals[0].id as string;
    expect((await post(id, 2)).status).toBe(409);
    const response = await post(id, 1);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.po_id).toMatch(/^PO-/);
    expect(database.prepare("SELECT state FROM purchase_order WHERE id=?").get(body.po_id)).toEqual({ state: "draft" });
    expect(database.prepare("SELECT count(*) AS n FROM obligation WHERE po_id=?").get(body.po_id)).toEqual({ n: 0 });
    approveOrder(body.po_id, 1);
    expect(database.prepare("SELECT count(*) AS n FROM obligation WHERE po_id=?").get(body.po_id)).toEqual({ n: 2 });
    expect((await post(id, 1)).status).toBe(409);
  });

  it("cannot approve an old proposal after a newer run supersedes it", async () => {
    const database = fixture();
    const first = await runCalculation({}, {}, { database, as_of: "2025-01-01" });
    const next = await runCalculation({}, {}, { database, as_of: "2025-01-02" });
    const oldId = first.proposals[0].id as string;
    expect((await post(oldId, 1)).status).toBe(409);
    expect(next.proposals[0].supersedes_id).toBe(oldId);
    expect(database.prepare("SELECT count(*) AS n FROM purchase_order").get()).toEqual({ n: 0 });
  });

  it("binds an adjusted quantity to a new proposal version", async () => {
    const database = fixture();
    const run = await runCalculation({}, {}, { database, as_of: "2025-01-01" });
    const proposal = run.proposals[0];
    const payload = JSON.parse(proposal.payload as string) as { lines: { recommendation_id: string; qty: number }[] };
    const original = payload.lines[0];
    const adjusted = await adjustRecommendation(original.recommendation_id, original.qty + 5, "Новая потребность", 1, { database });
    expect(adjusted.qty_recommended).toBe(original.qty);
    expect(adjusted.proposal_version).toBe(2);
    expect((await post(proposal.id as string, 1)).status).toBe(409);
    const response = await post(proposal.id as string, 2);
    expect(response.status).toBe(200);
    const order = await response.json();
    expect(database.prepare("SELECT qty FROM purchase_order_line WHERE po_id=?").get(order.po_id)).toEqual({ qty: original.qty + 5 });
  });
});
