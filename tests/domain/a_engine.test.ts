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

describe("deterministic replenishment need", () => {
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

  it("raises the forecast into the SKU's seasonal peak", async () => {
    const database = fixture({ seasonal: true });
    const quiet = await computeNeed("TEST", params, context(database, "2025-03-01"));
    const peak = await computeNeed("TEST", params, context(database, "2025-09-01"));
    expect(peak.components.forecast_qty).toBeGreaterThan(quiet.components.forecast_qty as number);
  });

  it("compensates a censored stockout month", async () => {
    const baseline = await computeNeed("TEST", params, context(fixture()));
    const censored = await computeNeed("TEST", params, context(fixture({ stockout: true })));
    expect(censored.components.stockout_months).toContain("2025-08");
    expect(censored.components.stockout_uplift).toBeGreaterThan(0);
    expect(censored.need).toBeGreaterThanOrEqual(baseline.need - 1);
  });

  it("excludes an injected one-off document from regular demand", async () => {
    const baseline = await computeNeed("TEST", params, context(fixture()));
    const spiked = await computeNeed("TEST", params, context(fixture({ oneoff: true })));
    expect(spiked.components.outliers_excluded).toEqual(expect.arrayContaining([expect.objectContaining({ doc_no: "ONEOFF" })]));
    expect(Math.abs(spiked.need - baseline.need)).toBeLessThanOrEqual(1);
    expect(spiked.rationale_ru).toContain("ONEOFF");
  });

  it("excludes the eval document and a 5000-unit injection on a high-volume SKU", async () => {
    const database = fixture();
    database.prepare("UPDATE sku SET median_month_qty='14502',p95_doc_qty='144' WHERE code_1c='TEST'").run();
    database.prepare("INSERT INTO sales_line (code_1c,doc_no,at,qty) VALUES ('TEST','20000099834','2025-07-20','7488')").run();
    const before = await computeNeed("TEST", params, context(database));
    database.prepare("INSERT INTO sales_line (code_1c,doc_no,at,qty) VALUES ('TEST','INJECTED','2025-08-20','5000')").run();
    const after = await computeNeed("TEST", params, context(database));
    expect(after.components.outlier_threshold).toBe(720);
    expect(after.components.outliers_excluded).toEqual(expect.arrayContaining([
      expect.objectContaining({ doc_no: "20000099834" }), expect.objectContaining({ doc_no: "INJECTED" }),
    ]));
    expect(after.rationale_ru).toContain("исключено");
    expect(after.rationale_ru).toContain("20000099834");
    expect(Math.abs((after.components.base_rate as number) / (before.components.base_rate as number) - 1)).toBeLessThan(0.1);
  });

  it("refuses a missing stock source", async () => {
    const database = fixture();
    database.prepare("DELETE FROM stock_month WHERE code_1c='TEST'").run();
    await expect(computeNeed("TEST", params, context(database))).rejects.toThrow(/stock/i);
  });

  it("records all inputs and arithmetic in components", async () => {
    const result = await computeNeed("TEST", params, context(fixture()));
    expect(result.components).toEqual(expect.objectContaining({ on_hand: 20, in_transit: 0, moq: 1 }));
    expect(result.rationale_ru).toContain("20");
    expect(result.need).toBeGreaterThan(0);
  });
});
