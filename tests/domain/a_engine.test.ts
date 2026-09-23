import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { migrate } from "../../src/db/client";
import { computeNeed, type EngineParams } from "../../src/domain/engine";

const params: EngineParams = {
  lead_time_days: 40, review_days: 30, service_level: 0.9, growth_cap: 0.5,
  outlier: { k_month: 3, k_doc: 5, min_units: 20 },
};

function fixture(options: { seasonal?: boolean; stockout?: boolean; oneoff?: boolean; inTransit?: number } = {}) {
  const database = new DatabaseSync(":memory:");
  migrate(database);
  database.prepare("INSERT INTO supplier (id,name,lead_time_days) VALUES ('IEK','IEK',40)").run();
  database.prepare("INSERT INTO sku (code_1c,supplier_id,name,moq,median_month_qty,p95_doc_qty) VALUES ('TEST','IEK','Тест',1,'10','10')").run();
  const months = Array.from({ length: 24 }, (_, index) => {
    const year = 2024 + Math.floor(index / 12);
    const month = String(index % 12 + 1).padStart(2, "0");
    return `${year}-${month}`;
  });
  for (const ym of months) {
    const quantity = options.seasonal && ym.endsWith("-10") ? 40 : 10;
    const censored = options.stockout && ym === "2025-08";
    database.prepare("INSERT INTO sales_month (code_1c,ym,qty_file,stockout) VALUES (?,?,?,?)")
      .run("TEST", ym, censored ? "0" : String(quantity), censored ? 1 : 0);
    if (!censored) for (let part = 0; part < (quantity > 20 ? 2 : 1); part++)
      database.prepare("INSERT INTO sales_line (code_1c,doc_no,at,qty) VALUES ('TEST',?,?,?)")
        .run(`DOC-${ym}-${part}`, `${ym}-15`, String(quantity > 20 ? quantity / 2 : quantity));
  }
  if (options.oneoff) database.prepare("INSERT INTO sales_line (code_1c,doc_no,at,qty,source) VALUES ('TEST','ONEOFF','2025-08-20','5000','judge')").run();
  database.prepare("INSERT INTO stock_month (code_1c,ym,opening_qty) VALUES ('TEST','2025-01','20')").run();
  if (options.inTransit) database.prepare("INSERT INTO in_transit (code_1c,po_ref,qty) VALUES ('TEST','PO-1',?)").run(String(options.inTransit));
  return database;
}

const context = (database: DatabaseSync, as_of = "2025-09-23") => ({ database, as_of });

function eightyFixture() {
  const database = new DatabaseSync(":memory:");
  migrate(database);
  database.prepare("INSERT INTO supplier(id,name,lead_time_days) VALUES ('IEK','IEK',30)").run();
  database.prepare("INSERT INTO sku(code_1c,supplier_id,name,moq) VALUES ('EIGHTY','IEK','Eighty',1)").run();
  database.prepare("INSERT INTO sales_month(code_1c,ym,qty_file) VALUES ('EIGHTY','2025-01','80')").run();
  for (let i = 0; i < 8; i++) database.prepare("INSERT INTO sales_line(code_1c,doc_no,at,qty) VALUES ('EIGHTY',?,'2025-01-15','10')").run(`DOC-${i}`);
  database.prepare("INSERT INTO stock_month(code_1c,ym,opening_qty) VALUES ('EIGHTY','2025-01','0')").run();
  return database;
}

const eightyParams: EngineParams = { ...params, lead_time_days: 30, review_days: 0 };

describe("deterministic replenishment need", () => {
  it("keeps regular demand at 30 when a 5000-unit world document is excluded, not 27.5", async () => {
    const database = new DatabaseSync(":memory:");
    migrate(database);
    database.prepare("INSERT INTO supplier(id,name,lead_time_days) VALUES ('IEK','IEK',30)").run();
    database.prepare("INSERT INTO sku(code_1c,supplier_id,name,moq) VALUES ('THIRTY','IEK','Thirty',1)").run();
    for (let month = 1; month <= 12; month++) {
      const ym = `2024-${String(month).padStart(2, "0")}`;
      database.prepare("INSERT INTO sales_month(code_1c,ym,qty_file) VALUES ('THIRTY',?,'30')").run(ym);
      database.prepare("INSERT INTO sales_line(code_1c,doc_no,at,qty) VALUES ('THIRTY',?,?,'30')").run(`DOC-${ym}`, `${ym}-15`);
    }
    database.prepare("INSERT INTO stock_month(code_1c,ym,opening_qty) VALUES ('THIRTY','2024-12','0')").run();
    const before = await computeNeed("THIRTY", eightyParams, context(database, "2025-01-01"));
    database.prepare("INSERT INTO sales_line(code_1c,doc_no,doc_type,at,qty,source) VALUES ('THIRTY','WORLD-5000','sales_day','2024-12-20','5000','world')").run();
    const after = await computeNeed("THIRTY", eightyParams, context(database, "2025-01-01"));
    expect(before.components.base_rate).toBe(30);
    expect(after.components.outliers_excluded).toEqual([expect.objectContaining({ doc_no: "WORLD-5000", qty: 5000 })]);
    expect(after.components.base_rate).toBe(30);
  });
  it("keeps a sole legitimate 100-unit document instead of excluding it at threshold 20", async () => {
    const database = eightyFixture();
    database.prepare("DELETE FROM sales_line WHERE code_1c='EIGHTY'").run();
    database.prepare("UPDATE sales_month SET qty_file='100' WHERE code_1c='EIGHTY'").run();
    database.prepare("INSERT INTO sales_line(code_1c,doc_no,at,qty) VALUES ('EIGHTY','ONLY','2025-01-15','100')").run();
    const result = await computeNeed("EIGHTY", eightyParams, context(database, "2025-02-01"));
    expect(result.components.outlier_threshold).toBe(20);
    expect(result.components.outliers_excluded).toEqual([]);
    expect(result.components.outliers_pending_review).toEqual([expect.objectContaining({ doc_no: "ONLY", qty: 100 })]);
    expect(result.flags).toContain("проверить вручную");
    expect(result.need).toBe(100);
  });
  it("deduplicates 30 approved units already represented by matching 30 in transit: 20 to 50", async () => {
    const database = eightyFixture();
    database.prepare("INSERT INTO in_transit(code_1c,po_ref,qty,expected_at) VALUES ('EIGHTY','PO-30','30','2025-02-10')").run();
    database.prepare("INSERT INTO purchase_order(id,supplier_id,state,eta) VALUES ('PO-30','IEK','approved','2025-02-10')").run();
    database.prepare("INSERT INTO purchase_order_line(po_id,code_1c,qty) VALUES ('PO-30','EIGHTY',30)").run();
    const result = await computeNeed("EIGHTY", eightyParams, context(database, "2025-02-01"));
    expect(result.components.forecast_qty).toBe(80);
    expect(result.components.in_transit).toBe(30);
    expect(result.components.approved_order_qty).toBe(0);
    expect(result.need).toBe(50);
  });
  it("completes a supplier's SKUs when one has no sales", async () => {
    const database = fixture();
    database.prepare("INSERT INTO sku (code_1c,supplier_id,name,moq) VALUES ('INACTIVE','IEK','Без продаж',1)").run();
    database.prepare("INSERT INTO stock_month (code_1c,ym,opening_qty) VALUES ('INACTIVE','2025-09','5')").run();
    const results = await Promise.all(["TEST", "INACTIVE"].map((code) => computeNeed(code, params, context(database))));
    expect(results[0].need).toBeGreaterThan(0);
    expect(results[1]).toMatchObject({ need: 0, flags: ["inactive"], components: { flags: ["inactive"] } });
    expect(results[1].rationale_ru).toContain("нет продаж за период — заказ не требуется");
  });

  it("reduces need when in-transit supply rises", async () => {
    const base = await computeNeed("TEST", params, context(fixture()));
    const supplied = await computeNeed("TEST", params, context(fixture({ inTransit: 2 })));
    expect(base.need - supplied.need).toBe(2);
  });

  it("counts only transit due within the horizon and names its arrival date", async () => {
    const database = fixture();
    database.prepare("INSERT INTO in_transit(code_1c,po_ref,qty,expected_at) VALUES ('TEST','SOON','4','2025-09-30')").run();
    database.prepare("INSERT INTO in_transit(code_1c,po_ref,qty,expected_at) VALUES ('TEST','LATE','100','2026-01-01')").run();
    const result = await computeNeed("TEST", params, context(database));
    expect(result.components.in_transit).toBe(4);
    expect(result.components.in_transit_sources).toEqual([expect.objectContaining({ po_ref: "SOON", expected_at: "2025-09-30" })]);
    expect(result.rationale_ru).toContain("прибудет до 30.09");
  });

  it("uses metre units, an IEK minimum, and an SE multiple", async () => {
    const database = fixture();
    database.prepare("UPDATE sku SET unit='м',moq=10 WHERE code_1c='TEST'").run();
    const baseline = await computeNeed("TEST", params, context(database));
    const onHand = Number(baseline.components.on_hand) + Number(baseline.components.net_need) - 12.1;
    database.prepare("UPDATE stock_month SET opening_qty=? WHERE code_1c='TEST'").run(String(onHand));
    const iek = await computeNeed("TEST", params, context(database));
    expect(iek.need).toBe(13);
    expect(iek.rationale_ru).toContain("потребность 13 м (минимум 10 м)");
    database.prepare("UPDATE stock_month SET opening_qty=? WHERE code_1c='TEST'").run(String(onHand + 6));
    const belowMinimum = await computeNeed("TEST", params, context(database));
    expect(belowMinimum.need).toBe(10);
    database.prepare("UPDATE stock_month SET opening_qty=? WHERE code_1c='TEST'").run(String(onHand));
    database.prepare("INSERT INTO supplier (id,name,lead_time_days) VALUES ('SE','SE',40)").run();
    database.prepare("UPDATE sku SET supplier_id='SE' WHERE code_1c='TEST'").run();
    const se = await computeNeed("TEST", params, context(database));
    expect(se.need).toBe(20);
    expect(se.rationale_ru).toContain("потребность 20 м (кратность 10 м)");
  });

  it("responds to sales and stock changes independently", async () => {
    const database = fixture();
    const before = await computeNeed("TEST", params, context(database));
    database.prepare("UPDATE stock_month SET opening_qty='18' WHERE code_1c='TEST'").run();
    const lessStock = await computeNeed("TEST", params, context(database));
    expect(lessStock.need).toBeGreaterThan(before.need);
    database.prepare("UPDATE sales_month SET qty_file='30' WHERE code_1c='TEST' AND ym='2025-08'").run();
    const moreSales = await computeNeed("TEST", params, context(database));
    expect(moreSales.components.base_rate).toBeGreaterThan(lessStock.components.base_rate as number);
  });

  it("averages completed months starting at first sale, excluding current partial month", async () => {
    const database = fixture();
    database.prepare("UPDATE sku SET first_sale_ym='2025-05' WHERE code_1c='TEST'").run();
    database.prepare("UPDATE sales_month SET qty_file='0' WHERE code_1c='TEST' AND ym<'2025-05'").run();
    database.prepare("UPDATE sales_month SET qty_file='1000' WHERE code_1c='TEST' AND ym='2025-09'").run();
    const result = await computeNeed("TEST", params, context(database, "2025-09-23"));
    expect(result.components.source_months).toBe(4);
    expect(result.components.base_rate).toBe(10);
  });

  it("includes a new world sales day but excludes its one-off judge document", async () => {
    const database = fixture();
    const before = await computeNeed("TEST", params, context(database));
    database.prepare("INSERT INTO sales_line (code_1c,doc_no,doc_type,at,qty,source) VALUES ('TEST','WORLD-1','sales_day','2025-08-20','10','world')").run();
    const afterSale = await computeNeed("TEST", params, context(database));
    expect(afterSale.components.base_rate).toBeGreaterThan(before.components.base_rate as number);
    database.prepare("INSERT INTO sales_line (code_1c,doc_no,doc_type,at,qty,source) VALUES ('TEST','JUDGE-1','judge_message','2025-08-20','5000','judge')").run();
    const afterOutlier = await computeNeed("TEST", params, context(database));
    expect(afterOutlier.components.base_rate).toBe(afterSale.components.base_rate);
    expect(afterOutlier.components.outliers_excluded).toEqual(expect.arrayContaining([expect.objectContaining({ doc_no: "JUDGE-1" })]));
  });

  it("raises the forecast into the SKU's seasonal peak", async () => {
    const database = fixture({ seasonal: true });
    const quiet = await computeNeed("TEST", params, context(database, "2025-03-01"));
    const peak = await computeNeed("TEST", params, context(database, "2025-09-01"));
    expect(peak.components.forecast_qty).toBeGreaterThan(quiet.components.forecast_qty as number);
  });

  it("shows raw and corrected demand for the same SKU with observed stockout", async () => {
    const result = await computeNeed("TEST", params, context(fixture({ stockout: true })));
    expect(result.components.stockout_months).toContain("2025-08");
    expect(result.components.stockout_uplift).toBeGreaterThan(0);
    expect(result.components.corrected_demand_rate).toBeGreaterThan(result.components.raw_demand_rate as number);
    expect(result.rationale_ru).toContain(`фактические продажи ${result.components.raw_demand_rate}`);
    expect(result.rationale_ru).toContain(`спрос с учётом дефицита ${result.components.corrected_demand_rate}`);
  });

  it("excludes an injected one-off document from regular demand", async () => {
    const baseline = await computeNeed("TEST", params, context(fixture()));
    const spiked = await computeNeed("TEST", params, context(fixture({ oneoff: true })));
    expect(spiked.components.outliers_excluded).toEqual(expect.arrayContaining([expect.objectContaining({ doc_no: "ONEOFF" })]));
    expect(Math.abs(spiked.need - baseline.need)).toBeLessThanOrEqual(1);
    expect(spiked.rationale_ru).toContain("ONEOFF");
  });

  it("uses peer documents for a sparse SKU with no cached statistics", async () => {
    const database = fixture();
    database.prepare("UPDATE sku SET median_month_qty=NULL,p95_doc_qty=NULL WHERE code_1c='TEST'").run();
    database.prepare("UPDATE sales_month SET qty_file='10000' WHERE code_1c='TEST'").run();
    database.prepare("DELETE FROM sales_line WHERE code_1c='TEST' AND at<'2025-07-01'").run();
    const before = await computeNeed("TEST", params, context(database));
    database.prepare("INSERT INTO sales_line (code_1c,doc_no,at,qty,source) VALUES ('TEST','SPARSE-5000','2025-08-20','5000','judge')").run();
    const after = await computeNeed("TEST", params, context(database));
    expect(after.components.outliers_excluded).toEqual(expect.arrayContaining([expect.objectContaining({ doc_no: "SPARSE-5000", threshold: 50 })]));
    expect(after.components.base_rate).toBe(before.components.base_rate);
  });

  it("excludes the eval document and a 5000-unit injection on a high-volume SKU", async () => {
    const database = fixture();
    database.prepare("UPDATE sku SET median_month_qty='14502',p95_doc_qty='144' WHERE code_1c='TEST'").run();
    database.prepare("INSERT INTO sales_line (code_1c,doc_no,at,qty) VALUES ('TEST','20000099834','2025-07-20','7488')").run();
    const before = await computeNeed("TEST", params, context(database));
    database.prepare("INSERT INTO sales_line (code_1c,doc_no,at,qty,source) VALUES ('TEST','INJECTED','2025-08-20','5000','judge')").run();
    const after = await computeNeed("TEST", params, context(database));
    expect(after.components.outlier_threshold).toBe(50);
    expect(after.components.outliers_excluded).toEqual(expect.arrayContaining([
      expect.objectContaining({ doc_no: "20000099834" }), expect.objectContaining({ doc_no: "INJECTED" }),
    ]));
    expect(after.rationale_ru).toContain("исключены");
    expect(after.rationale_ru).toContain("20000099834");
    expect(Math.abs((after.components.base_rate as number) / (before.components.base_rate as number) - 1)).toBeLessThan(0.1);
  });

  it("refuses a missing stock source", async () => {
    const database = fixture();
    database.prepare("DELETE FROM stock_month WHERE code_1c='TEST'").run();
    await expect(computeNeed("TEST", params, context(database))).rejects.toThrow(/stock/i);
  });

  it("marks an old stock snapshot provisional", async () => {
    const result = await computeNeed("TEST", params, context(fixture(), "2025-09-23"));
    expect(result.components.stock_stale).toBe(true);
    expect(result.rationale_ru).toContain("текущий остаток неизвестен");
  });

  it("records all inputs and arithmetic in components", async () => {
    const result = await computeNeed("TEST", params, context(fixture()));
    expect(result.components).toEqual(expect.objectContaining({ on_hand: 20, in_transit: 0, moq: 1 }));
    expect(result.rationale_ru).toContain("20");
    expect(result.need).toBeGreaterThan(0);
  });

  it("uses a fresh on-hand snapshot only once it is dated", async () => {
    const database = fixture();
    database.prepare("UPDATE sku SET on_hand_qty='7',on_hand_as_of='2025-09-22' WHERE code_1c='TEST'").run();
    expect((await computeNeed("TEST", params, context(database, "2025-09-01"))).components.on_hand).toBe(20);
    const fresh = await computeNeed("TEST", params, context(database));
    expect(fresh.components).toMatchObject({ on_hand: 7, on_hand_as_of: "2025-09-22" });
  });
});
