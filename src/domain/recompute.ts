import { db } from "../db/client";
import { runCalculation } from "./apply";

/** Persist an affected-only run; never rescan unrelated SKUs into its recommendations. */
export async function recomputeAffected(codes: string[]): Promise<{ affected_codes: string[]; run_id: string | null; recommendation_ids: string[] }> {
  const d = db();
  const affected_codes = [...new Set(codes)].filter(code => !!d.prepare("SELECT 1 FROM sku WHERE code_1c=?").get(code));
  if (!affected_codes.length) return { affected_codes, run_id: null, recommendation_ids: [] };
  const run = await runCalculation({ codes: affected_codes });
  const recommendation_ids = (d.prepare("SELECT id FROM recommendation WHERE run_id=? ORDER BY code_1c").all(run.run_id) as { id: string }[]).map(row => row.id);
  return { affected_codes, run_id: run.run_id, recommendation_ids };
}
