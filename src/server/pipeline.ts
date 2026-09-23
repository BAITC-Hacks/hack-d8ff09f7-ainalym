// Seam (L1 implements): every entry inserts one world_event and hands it to the worker synchronously.
import { processEvent } from "@/ai/worker";
export interface OnEventResult { event_id: string | null; run_id?: string | null; replayed?: boolean }
export async function onEvent(_kind: string, _payload: unknown, _source_id: string): Promise<OnEventResult> {
  const r = await processEvent("WE-STUB");
  return { event_id: null, run_id: r.run_id, replayed: false };
}
