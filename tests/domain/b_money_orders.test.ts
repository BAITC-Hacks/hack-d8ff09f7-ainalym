import { beforeEach, describe, expect, it } from "vitest";
import { db, resetInstance } from "../../src/db/client";
import { approveOrder, markOrderExported } from "../../src/domain/orders";
import { syncOrderObligations } from "../../src/domain/obligations";
import { moneyView } from "../../src/domain/cashflow";
import { applyWorldEvent } from "../../src/domain/events";
import { skuView } from "../../src/domain/skus";
import { recomputeAffected } from "../../src/domain/recompute";

const q = (sql: string, ...args: (string | number | null)[]) => db().prepare(sql).run(...args);
const one = (sql: string, ...args: (string | number | null)[]) => db().prepare(sql).get(...args) as Record<string, unknown> | undefined;

function seed() {
  q("INSERT INTO organization(id,name,payload) VALUES ('ORG','Partner',?)", JSON.stringify({ opening_cash: [{ amount: "1000.00", currency: "KZT" }, { amount: "50.00", currency: "USD" }] }));
  q("INSERT INTO supplier(id,name,lead_time_days,review_days,terms,currency) VALUES ('SE','SE',50,30,?,'KZT')", JSON.stringify({ prepayment_pct: 30 }));
  q("INSERT INTO supplier(id,name,lead_time_days,review_days,terms,currency) VALUES ('IEK','IEK',40,30,?,'KZT')", JSON.stringify({ prepayment_pct: 30 }));
  q("INSERT INTO sku(code_1c,supplier_id,name,unit_cost,moq) VALUES ('SE-1','SE','Known','100.00',1)");
  q("INSERT INTO sku(code_1c,supplier_id,name,unit_cost,moq) VALUES ('IEK-1','IEK','Unknown',NULL,1)");
  q("INSERT INTO calc_run(id,scope,params,started_at) VALUES ('RUN-1','{}','{}','2026-09-23T00:00:00Z')");
  q("INSERT INTO purchase_order(id,supplier_id,run_id,state,total_qty,total_cost,cost_known_lines,eta,version) VALUES ('PO-1','SE','RUN-1','draft',10,'1000.00',1,'2026-10-10T00:00:00Z',2)");
  q("INSERT INTO purchase_order_line(po_id,code_1c,qty,unit_cost,rationale_ru) VALUES ('PO-1','SE-1',10,'100.00','Спрос и запас')");
  q("INSERT INTO purchase_order(id,supplier_id,run_id,state,total_qty,total_cost,cost_known_lines,eta,version) VALUES ('PO-2','IEK','RUN-1','draft',4,NULL,0,'2026-10-01T00:00:00Z',1)");
  q("INSERT INTO purchase_order_line(po_id,code_1c,qty,unit_cost,rationale_ru) VALUES ('PO-2','IEK-1',4,NULL,'Спрос и запас')");
}

beforeEach(() => {
  resetInstance();
  process.env.DATABASE_PATH = ":memory:";
  seed();
});

describe("purchase approvals and obligations", () => {
  it("rejects a stale order version", () => {
    expect(() => approveOrder("PO-1", 1)).toThrow(/stale|version/i);
    expect(one("SELECT state FROM purchase_order WHERE id='PO-1'")?.state).toBe("draft");
  });
  it("approves the exact version and bumps it once", () => {
    const order = approveOrder("PO-1", 2);
    expect(order.state).toBe("approved");
    expect(one("SELECT version FROM purchase_order WHERE id='PO-1'")?.version).toBe(3);
  });
  it("creates 30% prepayment at approval and 70% balance at ETA", () => {
    approveOrder("PO-1", 2);
    const rows = db().prepare("SELECT kind,amount,due_at,basis FROM obligation WHERE po_id='PO-1' ORDER BY kind DESC").all() as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.amount).sort()).toEqual(["300.00", "700.00"]);
    expect(rows.find(r => r.kind === "supplier_balance")?.due_at).toBe("2026-10-10T00:00:00Z");
    expect(rows.every(r => r.basis === "PO-1")).toBe(true);
  });
  it("never creates duplicate obligations for a repeated approval", () => {
    approveOrder("PO-1", 2);
    expect(() => approveOrder("PO-1", 2)).toThrow();
    expect(one("SELECT count(*) AS n FROM obligation WHERE po_id='PO-1'")?.n).toBe(2);
  });
  it("keeps unknown-cost orders approved without inventing a price", () => {
    approveOrder("PO-2", 1);
    expect(one("SELECT count(*) AS n FROM obligation WHERE po_id='PO-2'")?.n).toBe(0);
    expect(one("SELECT total_cost FROM purchase_order WHERE id='PO-2'")?.total_cost).toBeNull();
  });
  it("does not mark an order exported until an export exists", () => {
    approveOrder("PO-1", 2);
    expect(() => markOrderExported("PO-1", "")).toThrow();
    expect(one("SELECT state FROM purchase_order WHERE id='PO-1'")?.state).toBe("approved");
  });
  it("marks an approved order exported with its file path", () => {
    approveOrder("PO-1", 2);
    markOrderExported("PO-1", "exports/PO-1.csv");
    expect(one("SELECT state,export_path FROM purchase_order WHERE id='PO-1'")).toMatchObject({ state: "exported", export_path: "exports/PO-1.csv" });
  });
  it("syncs obligations without changing settled rows", () => {
    approveOrder("PO-1", 2);
    q("UPDATE obligation SET state='settled' WHERE kind='supplier_prepayment'");
    syncOrderObligations("PO-1");
    expect(one("SELECT state FROM obligation WHERE kind='supplier_prepayment'")?.state).toBe("settled");
  });
  it("keeps an open prepayment due date stable on a repeated sync", () => {
    approveOrder("PO-1", 2);
    q("UPDATE obligation SET due_at='2026-09-23T12:00:00Z' WHERE kind='supplier_prepayment'");
    syncOrderObligations("PO-1");
    expect(one("SELECT due_at FROM obligation WHERE kind='supplier_prepayment'")?.due_at).toBe("2026-09-23T12:00:00Z");
  });
});

describe("money derived from ledger rows", () => {
  it("keeps opening cash by currency", async () => {
    const view = await moneyView("ORG");
    expect(view.cash).toEqual(expect.arrayContaining([{ amount: "1000.00", currency: "KZT" }, { amount: "50.00", currency: "USD" }]));
  });
  it("states when the ETL has no opening cash row", async () => {
    q("DELETE FROM organization WHERE id='ORG'");
    const view = await moneyView("partner");
    expect(view.cash).toEqual([]);
    expect(view.risks).toEqual(expect.arrayContaining([expect.objectContaining({ code: "opening_cash_unknown" })]));
  });
  it("does not present an empty opening-cash list as a known zero balance", async () => {
    q("UPDATE organization SET payload=? WHERE id='ORG'", JSON.stringify({ opening_cash: [] }));
    const view = await moneyView("ORG");
    expect(view.cash).toEqual([]);
    expect(view.risks).toEqual(expect.arrayContaining([expect.objectContaining({ code: "opening_cash_unknown" })]));
  });
  it("adds incoming and subtracts outgoing payments once", async () => {
    q("INSERT INTO payment(id,direction,counterparty_id,amount,currency,payment_ref,at) VALUES ('P-1','in','X','500.00','KZT','REF-1','2026-09-23')");
    q("INSERT INTO payment(id,direction,counterparty_id,amount,currency,payment_ref,at) VALUES ('P-2','out','SE','300.00','KZT','REF-2','2026-09-23')");
    const view = await moneyView("ORG");
    expect(view.cash).toContainEqual({ amount: "1200.00", currency: "KZT" });
  });
  it("groups committed known cost by supplier", async () => {
    approveOrder("PO-1", 2);
    const view = await moneyView("ORG");
    expect(view.committed_by_supplier).toEqual(expect.arrayContaining([expect.objectContaining({ supplier_id: "SE", amount: "1000.00", currency: "KZT", lines: 1, cost_known_lines: 1 })]));
  });
  it("shows both obligation installments in the next 60 days", async () => {
    approveOrder("PO-1", 2);
    const view = await moneyView("ORG", new Date("2026-09-23T00:00:00Z"));
    expect(view.next_60d.out.map(r => r.amount).sort()).toEqual(["300.00", "700.00"]);
  });
  it("keeps an overdue open prepayment visible", async () => {
    approveOrder("PO-1", 2);
    q("UPDATE obligation SET due_at='2026-09-20T00:00:00Z' WHERE kind='supplier_prepayment'");
    const view = await moneyView("ORG", new Date("2026-09-23T00:00:00Z"));
    expect(view.next_60d.out.map(r => r.amount).sort()).toEqual(["300.00", "700.00"]);
  });
  it("states a cash shortfall in the obligation's currency", async () => {
    q("UPDATE organization SET payload=? WHERE id='ORG'", JSON.stringify({ opening_cash: [{ amount: "200.00", currency: "KZT" }] }));
    approveOrder("PO-1", 2);
    const view = await moneyView("ORG", new Date("2026-09-23T00:00:00Z"));
    expect(view.risks).toEqual(expect.arrayContaining([expect.objectContaining({ code: "cash_shortfall", amount: "800.00", currency: "KZT" })]));
  });
  it("counts missing cost instead of summing it as zero", async () => {
    approveOrder("PO-2", 1);
    const view = await moneyView("ORG");
    expect(view.risks.some(r => r.code === "cost_unknown" && r.count >= 1)).toBe(true);
    expect(view.committed_by_supplier).toEqual(expect.arrayContaining([expect.objectContaining({ supplier_id: "IEK", amount: null, cost_complete: false, unknown_cost_lines: 1 })]));
  });
  it("values only known-cost stock", async () => {
    q("INSERT INTO stock_month(code_1c,ym,opening_qty,known) VALUES ('SE-1','2026-09','5',1)");
    q("INSERT INTO stock_month(code_1c,ym,opening_qty,known) VALUES ('IEK-1','2026-09','7',1)");
    const view = await moneyView("ORG");
    expect(view.stock_value).toMatchObject({ amount: "500.00", currency: "KZT", cost_known_share: 0.5 });
  });
});

describe("world events and SKU drilldown", () => {
  const event = (id: string, kind: string, code_1c: string, payload: object, text?: string) => ({ id, kind, code_1c, payload: JSON.stringify(payload), text });
  it("appends a sales day once and marks only its SKU", async () => {
    const e = event("WE-1", "sales_day", "SE-1", { at: "2026-09-23", qty: 3, doc_no: "DOC-1" });
    expect((await applyWorldEvent(e)).affected_codes).toEqual(["SE-1"]);
    expect((await applyWorldEvent(e)).applied).toBe(false);
    expect(one("SELECT count(*) AS n FROM sales_line WHERE code_1c='SE-1'")?.n).toBe(1);
  });
  it("deduplicates distinct event IDs sharing an organization source ID", async () => {
    const first = { ...event("WE-SRC-1", "sales_day", "SE-1", { qty: 2, at: "2026-09-23" }), org_id: "ORG", source_id: "SOURCE-1" };
    const second = { ...event("WE-SRC-2", "sales_day", "SE-1", { qty: 2, at: "2026-09-23" }), org_id: "ORG", source_id: "SOURCE-1" };
    expect((await applyWorldEvent(first)).applied).toBe(true);
    expect((await applyWorldEvent(second)).applied).toBe(false);
    expect(one("SELECT count(*) AS n FROM sales_line WHERE code_1c='SE-1'")?.n).toBe(1);
  });
  it("records one action for multiple lines of the same SKU", async () => {
    const e = event("WE-LINES", "sales_day", "SE-1", { lines: [{ qty: 2, at: "2026-09-23" }, { qty: 3, at: "2026-09-23" }] });
    const result = await applyWorldEvent(e);
    expect(result.actions).toHaveLength(1);
    expect(one("SELECT qty_lines FROM sales_month WHERE code_1c='SE-1'")?.qty_lines).toBe("5");
  });
  it("keeps a returned quantity as a signed sales line", async () => {
    await applyWorldEvent(event("WE-RETURN", "sales_day", "SE-1", { qty: -2, at: "2026-09-23" }));
    expect(one("SELECT qty FROM sales_line WHERE code_1c='SE-1'")?.qty).toBe("-2");
  });
  it("updates the stock snapshot without treating blank as zero", async () => {
    await applyWorldEvent(event("WE-2", "stock_snapshot", "SE-1", { ym: "2026-09", opening_qty: null }));
    expect(one("SELECT known,opening_qty FROM stock_month WHERE code_1c='SE-1'")).toMatchObject({ known: 0, opening_qty: null });
  });
  it("accepts a world stock snapshot array and its explicit known flag", async () => {
    await applyWorldEvent(event("WE-STOCKS", "stock_snapshot", "SE-1", { ym: "2026-09", stocks: [{ code_1c: "SE-1", opening_qty: "0", known: 0 }] }));
    expect(one("SELECT known,opening_qty FROM stock_month WHERE code_1c='SE-1'")).toMatchObject({ known: 0, opening_qty: null });
  });
  it("updates in-transit quantity and marks the affected SKU", async () => {
    const r = await applyWorldEvent(event("WE-3", "in_transit_update", "SE-1", { po_ref: "SUP-1", qty: 100 }));
    expect(r.affected_codes).toEqual(["SE-1"]);
    expect(one("SELECT qty FROM in_transit WHERE code_1c='SE-1'")?.qty).toBe("100");
  });
  it("turns a one-off judge message into a flagged sales line", async () => {
    await applyWorldEvent(event("WE-4", "judge_message", "SE-1", { qty: 5000, at: "2026-09-23" }, "Разовый заказ 5000 шт"));
    expect(one("SELECT qty,source FROM sales_line WHERE code_1c='SE-1'")).toMatchObject({ qty: "5000", source: "judge" });
  });
  it("applies the judge one-off document payload", async () => {
    await applyWorldEvent(event("WE-J1", "judge_message", "SE-1", { action: "inject_sales_line", line: { code_1c: "SE-1", qty: "5000", at: "2026-08-22", doc_no: "JUDGE-DOC" } }));
    expect(one("SELECT doc_no,source FROM sales_line WHERE code_1c='SE-1'")).toMatchObject({ doc_no: "JUDGE-DOC", source: "judge" });
    expect(one("SELECT state,rule FROM outlier_doc WHERE doc_no='JUDGE-DOC'")).toMatchObject({ state: "excluded", rule: "explicit_judge_oneoff" });
  });
  it("applies the judge in-transit increase as a delta", async () => {
    q("INSERT INTO in_transit(code_1c,po_ref,qty) VALUES ('SE-1','BASE','20')");
    await applyWorldEvent(event("WE-J2", "judge_message", "SE-1", { action: "adjust_in_transit", delta_qty: 100 }));
    expect(one("SELECT sum(CAST(qty AS INTEGER)) AS n FROM in_transit WHERE code_1c='SE-1'")?.n).toBe(120);
  });
  it("applies the judge price update", async () => {
    await applyWorldEvent(event("WE-J3", "judge_message", "SE-1", { action: "update_unit_cost", to: "360.00" }));
    expect(one("SELECT unit_cost FROM sku WHERE code_1c='SE-1'")?.unit_cost).toBe("360.00");
  });
  it("updates unit cost from a price event", async () => {
    await applyWorldEvent(event("WE-5", "price_update", "SE-1", { unit_cost: "125.00" }));
    expect(one("SELECT unit_cost FROM sku WHERE code_1c='SE-1'")?.unit_cost).toBe("125.00");
  });
  it("returns a SKU with its series, forecast and timeline", async () => {
    q("INSERT INTO stock_month(code_1c,ym,opening_qty,known) VALUES ('SE-1','2026-09','5',1)");
    const view = await skuView("SE-1");
    expect(view).toMatchObject({ sku: { code_1c: "SE-1" }, series: expect.any(Array), in_transit: expect.any(Array), timeline: expect.any(Array) });
    expect((view?.series as Record<string, unknown>[])[0].outliers).toEqual([]);
  });
  it("recomputes exactly the requested codes", async () => {
    q("INSERT INTO sales_month(code_1c,ym,qty_file) VALUES ('SE-1','2026-08','10')");
    q("INSERT INTO stock_month(code_1c,ym,opening_qty,known) VALUES ('SE-1','2026-08','5',1)");
    const r = await recomputeAffected(["SE-1"]);
    expect(r.affected_codes).toEqual(["SE-1"]);
    expect(r.affected_codes).not.toContain("IEK-1");
    expect(r.run_id).toMatch(/^RUN-/);
    expect(one("SELECT count(*) AS n FROM recommendation WHERE run_id=? AND code_1c='SE-1'", r.run_id!)?.n).toBe(1);
    expect(one("SELECT count(*) AS n FROM recommendation WHERE run_id=? AND code_1c='IEK-1'", r.run_id!)?.n).toBe(0);
  });
});
