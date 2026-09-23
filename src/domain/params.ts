import type { DatabaseSync } from "node:sqlite";
import { db } from "../db/client";
import type { EngineParams } from "./engine";

export const DEFAULT_PARAMS: EngineParams = {
  lead_time_days: 40,
  review_days: 30,
  service_level: 0.9,
  growth_cap: 0.5,
  outlier: { k_month: 3, k_doc: 5, min_units: 20 },
};

export function paramsForSupplier(supplierId: string, database: DatabaseSync = db(), overrides: Partial<EngineParams> = {}): EngineParams {
  const row = database.prepare("SELECT lead_time_days,review_days FROM supplier WHERE id=?")
    .get(supplierId) as { lead_time_days: number; review_days: number } | undefined;
  if (!row) throw new Error(`supplier ${supplierId} is missing`);
  const merged = {
    ...DEFAULT_PARAMS,
    lead_time_days: row.lead_time_days,
    review_days: row.review_days,
    ...overrides,
    outlier: { ...DEFAULT_PARAMS.outlier, ...overrides.outlier },
  };
  if (!globalThis.Number.isInteger(merged.lead_time_days) || merged.lead_time_days < 1 ||
      !globalThis.Number.isInteger(merged.review_days) || merged.review_days < 0 ||
      merged.service_level <= 0 || merged.service_level >= 1 ||
      merged.growth_cap < 0 || merged.growth_cap > 1 ||
      merged.outlier.k_month < 1 || merged.outlier.k_doc < 1 || merged.outlier.min_units < 0) {
    throw new RangeError("invalid replenishment parameters");
  }
  return merged;
}
