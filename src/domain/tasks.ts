import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { db, bumpStateVersion } from "../db/client";
import { startRun, recordAction, finishRun } from "../server/ledger";

// L1's persisted ledger accepts the caller's database as its final argument.
const startRunIn = startRun as (input: Parameters<typeof startRun>[0], database: DatabaseSync) => ReturnType<typeof startRun>;
const recordActionIn = recordAction as (runId: string, action: Parameters<typeof recordAction>[1], database: DatabaseSync) => ReturnType<typeof recordAction>;
const finishRunIn = finishRun as (runId: string, state: "done" | "failed", database: DatabaseSync) => ReturnType<typeof finishRun>;

export type TaskState = "preparing" | "awaiting_supplier" | "needs_review" | "ready_to_handover" | "handed_over" | "handover_failed";
const next: Record<TaskState, TaskState[]> = {
  preparing: ["awaiting_supplier", "needs_review", "ready_to_handover"],
  awaiting_supplier: ["preparing", "needs_review"],
  needs_review: ["preparing", "ready_to_handover"],
  ready_to_handover: ["handed_over", "handover_failed"],
  handed_over: [],
  handover_failed: ["ready_to_handover"],
};
export class StaleTaskError extends Error { readonly status = 409; }
export interface TaskRow { id: string; title: string; state: TaskState; owner_role: string | null; proposal_id: string | null; next_event_at: string | null; updated_at: string; version: number }

export async function createTask(input: { title: string; state?: TaskState; owner_role?: string; proposal_id?: string; next_event_at?: string; sources?: unknown[] }, ctx: { database?: DatabaseSync; org_id?: string; run_id?: string } = {}) {
  const database = ctx.database ?? db();
  const id = `TK-${randomUUID()}`;
  const at = new Date().toISOString();
  const state = input.state ?? "preparing";
  database.prepare("INSERT INTO task (id,title,state,owner_role,proposal_id,next_event_at,updated_at) VALUES (?,?,?,?,?,?,?)")
    .run(id, input.title, state, input.owner_role ?? null, input.proposal_id ?? null, input.next_event_at ?? null, at);
  bumpStateVersion(database);
  const runId = ctx.run_id ?? await startRunIn({ org_id: ctx.org_id ?? "ORG-1", trigger_type: "goal", trigger_ref: id }, database);
  await recordActionIn(runId, { kind: "status_change", subject_ref: id, summary_ru: `Создана задача: ${input.title}`,
    rationale_ru: `Начальное состояние: ${state}`, sources: input.sources?.length ? input.sources : [`task:${id}`],
    autonomy: "auto", idempotency_key: `task:create:${id}` }, database);
  if (!ctx.run_id) await finishRunIn(runId, "done", database);
  return { id, state, version: 1, affected: { tasks: [id], proposals: input.proposal_id ? [input.proposal_id] : [] } };
}

/** The only path that changes an existing task state. */
export async function transitionTask(id: string, state: TaskState, version: number, ctx: { database?: DatabaseSync; org_id?: string; run_id?: string; sources?: unknown[] } = {}) {
  const database = ctx.database ?? db();
  const row = database.prepare("SELECT * FROM task WHERE id=?").get(id) as TaskRow | undefined;
  if (!row) throw new Error(`task ${id} is missing`);
  if (row.version !== version) throw new StaleTaskError(`task ${id} version is stale`);
  if (!next[row.state].includes(state)) throw new RangeError(`invalid task transition ${row.state} → ${state}`);
  const at = new Date().toISOString();
  const result = database.prepare("UPDATE task SET state=?,version=version+1,updated_at=? WHERE id=? AND version=?")
    .run(state, at, id, version);
  if (result.changes !== 1) throw new StaleTaskError(`task ${id} version is stale`);
  bumpStateVersion(database);
  const runId = ctx.run_id ?? await startRunIn({ org_id: ctx.org_id ?? "ORG-1", trigger_type: "goal", trigger_ref: id }, database);
  await recordActionIn(runId, { kind: "status_change", subject_ref: id,
    summary_ru: `Задача ${id}: ${row.state} → ${state}`, rationale_ru: `Переход разрешён из ${row.state}; версия ${version + 1}.`,
    sources: ctx.sources ?? [`task:${id}`], autonomy: "auto", idempotency_key: `task:transition:${id}:${version + 1}` }, database);
  if (!ctx.run_id) await finishRunIn(runId, "done", database);
  return { id, state, version: version + 1, affected: { tasks: [id], proposals: row.proposal_id ? [row.proposal_id] : [] } };
}
