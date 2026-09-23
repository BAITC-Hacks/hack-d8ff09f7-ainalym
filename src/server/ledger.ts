import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { bumpStateVersion, db, withTx } from "@/db/client";

export type Autonomy = "auto" | "escalated";
export interface ActionInput { kind: string; subject_ref?: string; summary_ru: string; rationale_ru?: string; sources?: unknown[]; autonomy?: Autonomy; result?: "done" | "needs_owner" | "failed"; provider?: string; model_version?: string; idempotency_key?: string; world_event_id?: string; code_1c?: string; po_id?: string }
export interface RunInput { org_id: string; trigger_type: string; trigger_ref?: string }

export function startRun(input: RunInput, d?: DatabaseSync, bump = true): string {
  const write = (tx: DatabaseSync) => {
    const id = `AR-${randomUUID()}`;
    tx.prepare("INSERT INTO agent_run (id,org_id,trigger_type,trigger_ref,started_at) VALUES (?,?,?,?,?)")
      .run(id, input.org_id, input.trigger_type, input.trigger_ref || null, new Date().toISOString());
    if (bump) bumpStateVersion(tx);
    return id;
  };
  return d ? write(d) : withTx(write);
}

export function recordAction(run_id: string, a: ActionInput, d?: DatabaseSync, bump = true): string {
  const write = (tx: DatabaseSync) => {
    if (a.idempotency_key) {
      const prior = tx.prepare("SELECT id FROM agent_action WHERE idempotency_key = ?").get(a.idempotency_key) as { id: string } | undefined;
      if (prior) return prior.id;
    }
    const run = tx.prepare("SELECT org_id FROM agent_run WHERE id = ?").get(run_id) as { org_id: string } | undefined;
    if (!run) throw new Error("Unknown agent run");
    const id = `AA-${randomUUID()}`;
    tx.prepare(`INSERT INTO agent_action (id,run_id,org_id,world_event_id,code_1c,po_id,kind,subject_ref,summary_ru,rationale_ru,sources,autonomy,result,provider,model_version,idempotency_key,at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, run_id, run.org_id, a.world_event_id || null, a.code_1c || null,
      a.po_id || null, a.kind, a.subject_ref || null, a.summary_ru, a.rationale_ru || null, JSON.stringify(a.sources || []),
      a.autonomy || "auto", a.result || "done", a.provider || null, a.model_version || null, a.idempotency_key || null, new Date().toISOString());
    tx.prepare("UPDATE agent_run SET actions_count = actions_count + 1, escalations_count = escalations_count + ? WHERE id = ?")
      .run(a.autonomy === "escalated" || a.result === "needs_owner" ? 1 : 0, run_id);
    if (bump) bumpStateVersion(tx);
    return id;
  };
  return d ? write(d) : withTx(write);
}

export function finishRun(run_id: string, state: "done" | "failed", d?: DatabaseSync, bump = true): void {
  const write = (tx: DatabaseSync) => {
    const result = tx.prepare("UPDATE agent_run SET state = ?, finished_at = ? WHERE id = ? AND state = 'running'")
      .run(state, new Date().toISOString(), run_id);
    if (result.changes && bump) bumpStateVersion(tx);
  };
  if (d) write(d); else withTx(write);
}

export function agentStats(org_id?: string): { auto: number; needs_you: number; ratio: number } {
  const where = org_id ? "WHERE org_id = ?" : "";
  const rows = db().prepare(`SELECT autonomy, COUNT(*) AS n FROM agent_action ${where} GROUP BY autonomy`).all(...(org_id ? [org_id] : [])) as { autonomy: string; n: number }[];
  const auto = rows.find(r => r.autonomy === "auto")?.n || 0;
  const needs_you = rows.find(r => r.autonomy === "escalated")?.n || 0;
  return { auto, needs_you, ratio: auto + needs_you ? auto / (auto + needs_you) : 0 };
}
