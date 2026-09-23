import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { computeNeed } from "../../src/domain/engine";
import { migrate } from "../../src/db/client";
import { paramsForSupplier } from "../../src/domain/params";
import { runCalculation } from "../../src/domain/apply";
import { databasePath } from "../../src/db/path.mjs";

const path = process.env.AINALYM_ETL_DATABASE_PATH || databasePath();
const fixture = JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/eval/replenishment_expectations.json"), "utf8")) as {
  as_of: string; skus: Record<string, { code_1c: string; supplier_id: string }>;
};
const database = existsSync(path) ? new DatabaseSync(path) : null;
if (database) migrate(database);
it("opens the resolved ETL database for the named partner checks", () => {
  expect(path).not.toBe(":memory:");
  expect(database).not.toBeNull();
});
const need = (name: string) => {
  if (!database) throw new Error("run npm run etl first");
  const sku = fixture.skus[name];
  return computeNeed(sku.code_1c, paramsForSupplier(sku.supplier_id, database), { database, as_of: fixture.as_of });
};

describe.skipIf(!database)("named partner SKU properties", () => {
  it("M1: in-transit changes signed need by exactly 100 units", async () => {
    const before = await need("intransit");
    database!.exec("BEGIN");
    try {
      database!.prepare("UPDATE in_transit SET qty=CAST(qty AS INTEGER)+100 WHERE id=(SELECT id FROM in_transit WHERE code_1c=? LIMIT 1)")
        .run(fixture.skus.intransit.code_1c);
      const after = await need("intransit");
      expect((before.components.net_need as number) - (after.components.net_need as number)).toBeCloseTo(100, 3);
    } finally { database!.exec("ROLLBACK"); }
  });

  it("M2: its own seasonal index peaks in Q3 and varies at least 1.3×", async () => {
    const result = await need("seasonal");
    const season = result.components.season as Record<string, number>;
    const indices = Object.values(season);
    expect(result.components.season_source).toBe("sku");
    expect(Math.max(...indices) / Math.min(...indices)).toBeGreaterThanOrEqual(1.3);
    const quarters = [0, 1, 2, 3].map((quarter) => [1, 2, 3].reduce((sum, offset) => sum + season[String(quarter * 3 + offset)], 0));
    expect(quarters.indexOf(Math.max(...quarters))).toBe(2);
  });

  it("M3: censored stockout months raise demand over the raw observed series", async () => {
    const result = await need("stockout");
    expect((result.components.stockout_months as unknown[]).length).toBeGreaterThan(0);
    expect(result.components.stockout_uplift).toBeGreaterThan(0);
    expect(result.components.forecast_qty).toBeGreaterThan(result.components.raw_observed_forecast as number);
  });

  it("M4: an injected 5000-unit document is excluded without changing regular rate", async () => {
    const before = await need("oneoff");
    expect(before.components.outliers_excluded).toEqual(expect.arrayContaining([expect.objectContaining({ doc_no: "20000099834" })]));
    database!.exec("BEGIN");
    try {
      database!.prepare("INSERT INTO sales_line (code_1c,doc_no,doc_type,at,qty,source) VALUES (?,?,?,?,'5000','judge')")
        .run(fixture.skus.oneoff.code_1c, "JUDGE-5000", "Расходная накладная", "2026-08-15T10:00:00");
      const after = await need("oneoff");
      expect(after.components.outliers_excluded).toEqual(expect.arrayContaining([expect.objectContaining({ doc_no: "JUDGE-5000" })]));
      const drift = Math.abs((after.components.base_rate as number) - (before.components.base_rate as number));
      expect(drift / (before.components.base_rate as number)).toBeLessThan(0.1);
    } finally { database!.exec("ROLLBACK"); }
  });

  it("M5: named recommendations carry supplier and numeric rationale, including missing cost", async () => {
    for (const name of Object.keys(fixture.skus)) {
      const result = await need(name);
      expect(result.rationale_ru).toContain(fixture.skus[name].code_1c);
      expect(result.rationale_ru).toContain("в пути");
      expect(result.components).toHaveProperty("moq");
    }
    const sku = database!.prepare("SELECT unit_cost FROM sku WHERE code_1c=?").get(fixture.skus.nocost.code_1c) as { unit_cost: string | null };
    expect(sku.unit_cost).toBeNull();
  });

  it("builds one SE supplier proposal while naming unresolved SKU sources", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ainalym-domain-"));
    const copy = join(dir, "partner.db");
    copyFileSync(path, copy);
    const writable = new DatabaseSync(copy);
    try {
      migrate(writable);
      const result = await runCalculation({ supplier: "SE" }, {}, { database: writable, as_of: fixture.as_of });
      expect(result.recommended).toBeGreaterThan(0);
      expect(result.proposals).toHaveLength(1);
      expect(result.unresolved.length).toBeGreaterThan(0);
      expect(result.unresolved[0].reason).toMatch(/source missing/);
    } finally { writable.close(); rmSync(dir, { recursive: true, force: true }); }
  }, 30000);
});
