// Seam (L3 implements): typed decisions for borderline outliers and change summaries.
export interface OutlierDecision { answer: "one_off" | "regular" | null; result_state: "decided" | "insufficient" | "unsupported" | "provider_error"; provider: string; model_version?: string; decision_record_id?: string }
export async function judgeOutlier(_doc: unknown, _stats: unknown): Promise<OutlierDecision> {
  return { answer: null, result_state: "unsupported", provider: "unavailable" };
}
export async function summarizeChanges(_run_id: string): Promise<string> {
  return "";
}
