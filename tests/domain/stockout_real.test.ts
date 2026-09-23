import { expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { computeNeed } from "../../src/domain/engine";
import { paramsForSupplier } from "../../src/domain/params";

it("300200898_ ETL demand: 20.84 raw → 21.541 corrected (formerly 19.522)", async () => {
  const database = new DatabaseSync(process.env.AINALYM_ETL_DATABASE_PATH || join(process.cwd(), "data", "ainalym.db"), { readOnly: true });
  try {
    const result = await computeNeed("300200898_", paramsForSupplier("SE", database), { database, as_of: "2026-09-23" });
    const raw = result.components.raw_demand_rate as number;
    const corrected = result.components.corrected_demand_rate as number;
    expect(raw).toBe(20.84);
    expect(result.components.stockout_months).toEqual(expect.arrayContaining(["2026-03", "2026-04"]));
    expect(corrected).toBeGreaterThanOrEqual(raw);
    expect(corrected).toBe(21.541);
    expect(result.rationale_ru).toContain(`фактические продажи ${raw} шт/мес; спрос с учётом дефицита ${corrected} шт/мес`);
  } finally { database.close(); }
});
