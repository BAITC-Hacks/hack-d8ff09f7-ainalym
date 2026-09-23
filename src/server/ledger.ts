import { randomUUID } from "node:crypto";
import { bumpStateVersion, db, withTx } from "../db/client";

export type Autonomy = "auto" | "escalated";
export interface ActionInput { kind: string; subject_ref?: string; summary_ru: string; rationale_ru?: string; sources?: unknown[]; autonomy?: Autonomy; result?: "done" | "needs_owner" | "failed"; provider?: string; model_version?: string; idempotency_key?: string; world_event_id?: string; code_1c?: string; po_id?: string }

export async function startRun(input: { org_id: string; trigger_type: string; trigger_ref?: string }): Promise<string> {
  const id = `AR-${randomUUID()}`;
  withTx(tx => {
    tx.prepare("INSERT INTO agent_run(id,org_id,trigger_type,trigger_ref,state,started_at) VALUES (?,?,?,?,'running',?)")
      .run(id, input.org_id, input.trigger_type, input.trigger_ref ?? null, new Date().toISOString());
    bumpStateVersion(tx);
  });
  return id;
}

export async function recordAction(run_id: string, action: ActionInput): Promise<string> {
  return withTx(tx => {
    if (action.idempotency_key) {
      const prior = tx.prepare("SELECT id FROM agent_action WHERE idempotency_key=?").get(action.idempotency_key) as { id: string } | undefined;
      if (prior) return prior.id;
    }
    const run = tx.prepare("SELECT org_id FROM agent_run WHERE id=?").get(run_id) as { org_id: string } | undefined;
    if (!run) throw new Error(`agent_run_not_found:${run_id}`);
    const id = `AA-${randomUUID()}`;
    tx.prepare(`INSERT INTO agent_action(id,run_id,org_id,world_event_id,code_1c,po_id,kind,subject_ref,summary_ru,rationale_ru,sources,autonomy,result,provider,model_version,idempotency_key,at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, run_id, run.org_id, action.world_event_id ?? null, action.code_1c ?? null,
        action.po_id ?? null, action.kind, action.subject_ref ?? null, action.summary_ru, action.rationale_ru ?? null,
        JSON.stringify(action.sources ?? []), action.autonomy ?? "auto", action.result ?? "done", action.provider ?? null,
        action.model_version ?? null, action.idempotency_key ?? null, new Date().toISOString());
    tx.prepare("UPDATE agent_run SET actions_count=actions_count+1,escalations_count=escalations_count+? WHERE id=?")
      .run(action.autonomy === "escalated" ? 1 : 0, run_id);
    bumpStateVersion(tx);
    return id;
  });
}

export async function finishRun(run_id: string, state: "done" | "failed"): Promise<void> {
  withTx(tx => {
    const changed = tx.prepare("UPDATE agent_run SET state=?,finished_at=? WHERE id=? AND state='running'")
      .run(state, new Date().toISOString(), run_id);
    if (changed.changes) bumpStateVersion(tx);
  });
}
