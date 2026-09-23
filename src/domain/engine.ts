// Seam (L2a implements): the deterministic need engine (ТЗ must-haves M1–M4).
export interface EngineParams { lead_time_days: number; review_days: number; service_level: number; growth_cap: number; outlier: { k_month: number; k_doc: number; min_units: number } }
export interface NeedResult { forecast: Record<string, unknown> | null; need: number; rationale_ru: string; components: Record<string, unknown> }
export async function computeNeed(_code_1c: string, _params: EngineParams, _ctx?: unknown): Promise<NeedResult> {
  return { forecast: null, need: 0, rationale_ru: "расчётный движок ещё не подключён", components: { empty_reason: "domain pending" } };
}
