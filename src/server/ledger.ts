// Seam (L1 implements): the agents' ledger — agent_run + agent_action in the caller's transaction.
export type Autonomy = "auto" | "escalated";
export interface ActionInput { kind: string; subject_ref?: string; summary_ru: string; rationale_ru?: string; sources?: unknown[]; autonomy?: Autonomy; result?: "done" | "needs_owner" | "failed"; provider?: string; model_version?: string; idempotency_key?: string; world_event_id?: string; code_1c?: string; po_id?: string }
let n = 0;
export async function startRun(_input: { org_id: string; trigger_type: string; trigger_ref?: string }): Promise<string> { return `RUN-STUB-${++n}`; }
export async function recordAction(_run_id: string, _a: ActionInput): Promise<string> { return `ACT-STUB-${++n}`; }
export async function finishRun(_run_id: string, _state: "done" | "failed"): Promise<void> { /* stub */ }
