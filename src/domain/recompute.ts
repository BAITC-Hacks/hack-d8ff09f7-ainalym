import { db } from "../db/client";
import { runCalculation } from "./apply";

/** Persist an affected-only run; never rescan unrelated SKUs into its recommendations. */
export async function recomputeAffected(codes: string[], agentRunId?: string, worldEventId?: string, orgId?: string): Promise<{ affected_codes: string[]; run_id: string | null; recommendation_ids: string[]; results: Record<string, { need: number; rationale_ru: string }>; proposal_ids: string[]; unresolved: { code_1c: string; supplier_id: string; reason: string }[] }> {
  const d = db();
  const affected_codes = [...new Set(codes)].filter(code => !!d.prepare("SELECT 1 FROM sku WHERE code_1c=?").get(code));
  if (!affected_codes.length) return { affected_codes, run_id: null, recommendation_ids: [], results: {}, proposal_ids: [], unresolved: [] };
  const run = await runCalculation({ codes: affected_codes }, {}, { org_id: orgId, agent_run_id: agentRunId, world_event_id: worldEventId });
  const rows = d.prepare("SELECT id,code_1c,qty_recommended,rationale_ru FROM recommendation WHERE run_id=? ORDER BY code_1c")
    .all(run.run_id) as { id: string; code_1c: string; qty_recommended: number; rationale_ru: string }[];
  return {
    affected_codes, run_id: run.run_id, recommendation_ids: rows.map(row => row.id),
    results: Object.fromEntries(rows.map(row => [row.code_1c, { need: row.qty_recommended, rationale_ru: row.rationale_ru }])),
    proposal_ids: run.proposals.map(proposal => String(proposal.id)),
    unresolved: run.unresolved,
  };
}
