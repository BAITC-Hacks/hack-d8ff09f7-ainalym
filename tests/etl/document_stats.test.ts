import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { migrate } from "../../src/db/client";

describe("ETL document statistics", () => {
  it("stores p95 of grouped documents instead of sales lines", () => {
    const dir = mkdtempSync(join(tmpdir(), "ainalym-doc-stats-"));
    try {
      const path = join(dir, "stats.sqlite");
      const database = new DatabaseSync(path);
      migrate(database);
      database.prepare("INSERT INTO supplier(id,name,lead_time_days) VALUES ('IEK','IEK',40)").run();
      database.prepare("INSERT INTO sku(code_1c,supplier_id,name) VALUES ('SKU','IEK','Тест')").run();
      for (const year of [2024, 2025]) for (let month = 1; month <= 12; month++)
        database.prepare("INSERT INTO seasonality(supplier_id,year,month,revenue_kzt) VALUES ('IEK',?,?,'100')").run(year, month);
      database.prepare("INSERT INTO sales_month(code_1c,ym,qty_file) VALUES ('SKU','2025-01','103')").run();
      for (const [doc, qty] of [["D1", "50"], ["D1", "50"], ["D2", "3"]])
        database.prepare("INSERT INTO sales_line(code_1c,doc_no,doc_type,at,qty) VALUES ('SKU',?,'Расходная накладная','2025-01-15',?)").run(doc, qty);
      database.close();
      execFileSync(process.execPath, [resolve("scripts/etl/derive.mjs"), "--db", path]);
      const result = new DatabaseSync(path);
      expect(result.prepare("SELECT p95_doc_qty FROM sku WHERE code_1c='SKU'").get()).toEqual({ p95_doc_qty: "100" });
      result.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
