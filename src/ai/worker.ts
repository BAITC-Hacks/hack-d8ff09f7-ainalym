// Seam (L3 implements): the background worker — drains pending world events, runs the engine on affected SKUs, escalates.
export interface ProcessResult { run_id: string | null; actions: number; escalations: number; reason?: string }
export interface TickResult { runs: string[]; processed: number }
export async function processEvent(_world_event_id: string): Promise<ProcessResult> {
  return { run_id: null, actions: 0, escalations: 0, reason: "worker pending" };
}
export async function tick(): Promise<TickResult> {
  return { runs: [], processed: 0 };
}
