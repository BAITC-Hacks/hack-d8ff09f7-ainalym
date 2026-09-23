// Seam (L2b implements): non-calculation world events → data changes + affected SKUs.
export interface WorldEventRow { id: string; kind: string; code_1c?: string | null; payload: string; text?: string | null }
export interface ApplyEventResult { applied: boolean; affected_codes: string[]; actions: unknown[]; escalations: unknown[]; reason?: string }
export async function applyWorldEvent(_event: WorldEventRow): Promise<ApplyEventResult> {
  return { applied: false, affected_codes: [], actions: [], escalations: [], reason: "domain pending" };
}
