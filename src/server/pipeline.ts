import { randomUUID } from "node:crypto";
import { processEvent } from "@/ai/worker";
import { bumpStateVersion, db, withTx } from "@/db/client";
import { WorldEventInputSchema } from "./contracts";
import { HttpError } from "./http";

export interface OnEventResult { event_id: string; run_id?: string | null; replayed?: boolean }

export async function onEvent(kind: string, payload: unknown, source_id: string): Promise<OnEventResult> {
  if (!source_id.trim()) throw new HttpError(400, "invalid_source", "Source ID is required", "source_id");
  if (!["sales_day", "stock_snapshot", "in_transit_update", "price_update", "judge_message", "supplier_reply"].includes(kind))
    throw new HttpError(400, "invalid_kind", "Unknown world event kind", "kind");
  const input = WorldEventInputSchema.parse(payload);
  const currentOrg = (db().prepare("SELECT id FROM organization LIMIT 1").get() as { id: string } | undefined)?.id || "DEMO-PARTNER-A";
  if (input.org_id && input.org_id !== currentOrg) throw new HttpError(404, "not_found", "Organization not found");
  const org_id = currentOrg;
  const result = withTx(tx => {
    const prior = tx.prepare("SELECT id, run_id FROM world_event WHERE org_id = ? AND source_id = ?").get(org_id, source_id) as { id: string; run_id: string | null } | undefined;
    if (prior) return { event_id: prior.id, run_id: prior.run_id, replayed: true };
    const id = `WE-${randomUUID()}`;
    const seq = (tx.prepare("SELECT COALESCE(MAX(seq),0)+1 AS n FROM world_event WHERE org_id = ?").get(org_id) as { n: number }).n;
    tx.prepare(`INSERT INTO world_event (id,org_id,seq,kind,actor_id,code_1c,po_id,at,source_id,text,payload,state,emitted_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending',?)`).run(id, org_id, seq, kind, input.actor_id || null, input.code_1c || null,
      input.po_id || null, input.at || new Date().toISOString(), source_id, input.text || null,
      JSON.stringify(input.payload || {}), new Date().toISOString());
    bumpStateVersion(tx);
    return { event_id: id, replayed: false };
  });
  if (result.replayed) return result;
  const processed = await processEvent(result.event_id);
  return { ...result, run_id: processed.run_id };
}
