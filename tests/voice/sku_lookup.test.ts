import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { db, resetInstance } from "../../src/db/client";
import { resolveSkuCode } from "../../src/server/sku_lookup";

const priorPath = process.env.DATABASE_PATH;
const etlPath = process.env.AINALYM_ETL_DATABASE_PATH ?? join(process.cwd(), "data", "ainalym.db");
const scope = { org_id: "partner", supplier_id: "IEK" };

beforeAll(() => {
  expect(existsSync(etlPath), "Run npm run etl before SKU lookup tests").toBe(true);
  resetInstance();
  process.env.DATABASE_PATH = etlPath;
  expect(db().prepare("SELECT code_1c FROM sku WHERE code_1c = ?").get("130200122_")).toBeTruthy();
});
afterAll(() => {
  resetInstance();
  if (priorPath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = priorPath;
});

describe("canonical SKU lookup against the partner ETL database", () => {
  it("trims quotes and spaces, then accepts the exact code case-insensitively", () => {
    expect(resolveSkuCode("  «130200122_»  ", scope)).toBe("130200122_");
  });
  it("tries a trailing underscore before prefix search", () => {
    expect(resolveSkuCode("130200122", scope)).toBe("130200122_");
  });
  it("falls back to a deterministic code prefix", () => {
    const expected = db().prepare("SELECT code_1c FROM sku WHERE supplier_id = 'IEK' AND code_1c LIKE '13020012%' ORDER BY length(code_1c), code_1c LIMIT 1").get() as { code_1c: string };
    expect(resolveSkuCode("13020012", scope)).toBe(expected.code_1c);
  });
  it("finds the supplier article when the code stages miss", () => {
    expect(resolveSkuCode("ynn10-812-10dp-k07", scope)).toBe("130200122_");
  });
  it("finds a name fragment of at least four characters", () => {
    expect(resolveSkuCode("Шина \"N\" нулевая 8х12мм комб с изол \"Стойка\" ШНИ 10 КС IEK (20)", scope)).toBe("130200122_");
    expect(resolveSkuCode("ШИНА \"N\" НУЛЕВАЯ 8Х12ММ КОМБ С ИЗОЛ \"СТОЙКА\" ШНИ 10 КС IEK (20)", scope)).toBe("130200122_");
    expect(resolveSkuCode("шин", scope)).toBeNull();
  });
  it("does not escape its supplier or selected SKU scope", () => {
    expect(resolveSkuCode("130200122", { org_id: "partner", supplier_id: "SE" })).toBeNull();
    expect(resolveSkuCode("130200122", { ...scope, code_1c: "010300001_" })).toBeNull();
  });
});
