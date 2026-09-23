// Seam (L2a implements): a calc run → recommendations → one supplier_order proposal per supplier.
export interface ApplyResult { proposals: unknown[]; tasks: unknown[]; affected: string[] }
export async function applyRecommendations(_run_id: string): Promise<ApplyResult> {
  return { proposals: [], tasks: [], affected: [] };
}
