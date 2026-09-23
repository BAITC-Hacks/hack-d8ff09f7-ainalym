import { db } from "../db/client";
import { computeNeed, type EngineParams, type NeedResult } from "./engine";

/** Recompute only the named SKUs; the worker decides when to publish new proposals. */
export async function recomputeAffected(codes: string[]): Promise<{ affected_codes: string[]; results: Record<string, NeedResult> }> {
  const d = db();
  const affected_codes = [...new Set(codes)].filter(code => !!d.prepare("SELECT 1 FROM sku WHERE code_1c=?").get(code));
  const results: Record<string, NeedResult> = {};
  for (const code of affected_codes) {
    const supplier = d.prepare("SELECT sup.lead_time_days,sup.review_days FROM sku s JOIN supplier sup ON sup.id=s.supplier_id WHERE s.code_1c=?").get(code) as { lead_time_days: number; review_days: number };
    const params: EngineParams = { lead_time_days: supplier.lead_time_days, review_days: supplier.review_days, service_level: 0.9, growth_cap: 0.5, outlier: { k_month: 3, k_doc: 5, min_units: 20 } };
    results[code] = await computeNeed(code, params);
  }
  return { affected_codes, results };
}
