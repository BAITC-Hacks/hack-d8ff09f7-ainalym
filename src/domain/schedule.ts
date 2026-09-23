import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { db, bumpStateVersion } from "../db/client";
import { startRun, recordAction, finishRun } from "../server/ledger";
import { runCalculation } from "./apply";

const startRunIn = startRun as (input: Parameters<typeof startRun>[0], database: DatabaseSync) => ReturnType<typeof startRun>;
const recordActionIn = recordAction as (runId: string, action: Parameters<typeof recordAction>[1], database: DatabaseSync) => ReturnType<typeof recordAction>;
const finishRunIn = finishRun as (runId: string, state: "done" | "failed", database: DatabaseSync) => ReturnType<typeof finishRun>;

type DueTask = { id: string; title: string; version: number; next_event_at: string; proposal_id: string | null };
type CoverRow = { id: string; code_1c: string; urgency: string; components: string; finished_at: string; lead_time_days: number };
type EventRow = { code_1c: string; latest_at: string };

/** A quiet tick writes nothing; due work yields review proposals or affected-SKU recomputes. */
export async function runScheduledChecks(now: string | Date = new Date(), ctx: { database?: DatabaseSync; org_id?: string } = {}) {
  const database = ctx.database ?? db();
  const orgId = ctx.org_id ?? "ORG-1";
  const at = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const due = database.prepare("SELECT id,title,version,next_event_at,proposal_id FROM task WHERE state='awaiting_supplier' AND next_event_at<=? ORDER BY next_event_at,id")
    .all(at) as DueTask[];
  const followups = due.filter((task) => !database.prepare("SELECT id FROM proposal WHERE kind='clarification' AND json_extract(payload,'$.task_id')=? AND json_extract(payload,'$.task_version')=?")
    .get(task.id, task.version));
  const coverRows = database.prepare(`SELECT r.id,r.code_1c,r.urgency,r.components,c.finished_at,s.lead_time_days
    FROM recommendation r JOIN calc_run c ON c.id=r.run_id JOIN sku k ON k.code_1c=r.code_1c JOIN supplier s ON s.id=k.supplier_id
    WHERE r.id=(SELECT r2.id FROM recommendation r2 JOIN calc_run c2 ON c2.id=r2.run_id WHERE r2.code_1c=r.code_1c ORDER BY c2.finished_at DESC,r2.id DESC LIMIT 1)
    AND r.urgency IN ('soon','normal')`).all() as CoverRow[];
  const crossing = coverRows.filter((row) => {
    const cover = (JSON.parse(row.components) as { days_of_cover?: number | null }).days_of_cover;
    if (cover === null || cover === undefined) return false;
    const daysElapsed = Math.max(0, Math.floor((Date.parse(at) - Date.parse(row.finished_at)) / 86_400_000));
    return cover - daysElapsed <= row.lead_time_days;
  });
  const events = database.prepare(`SELECT w.code_1c,MAX(COALESCE(w.processed_at,w.emitted_at,w.at)) AS latest_at
    FROM world_event w WHERE w.state='processed' AND w.kind IN ('sales_day','stock_snapshot','in_transit_update','price_update')
    AND w.code_1c IS NOT NULL GROUP BY w.code_1c`).all() as EventRow[];
  const staleCodes = events.filter((event) => {
    const latestRun = database.prepare(`SELECT c.finished_at FROM recommendation r JOIN calc_run c ON c.id=r.run_id
      WHERE r.code_1c=? ORDER BY c.finished_at DESC LIMIT 1`).get(event.code_1c) as { finished_at: string | null } | undefined;
    const attempted = database.prepare(`SELECT finished_at FROM calc_run c
      WHERE EXISTS (SELECT 1 FROM json_each(c.scope,'$.codes') WHERE value=?) ORDER BY finished_at DESC LIMIT 1`)
      .get(event.code_1c) as { finished_at: string | null } | undefined;
    const latest = [latestRun?.finished_at, attempted?.finished_at].filter((value): value is string => !!value).sort().at(-1);
    return !latest || event.latest_at > latest;
  }).map((event) => event.code_1c);
  if (!followups.length && !crossing.length && !staleCodes.length) return { runs: [], processed: 0, proposals: [], affected: [] };

  const runId = await startRunIn({ org_id: orgId, trigger_type: "scheduled_check", trigger_ref: at }, database);
  const proposals: string[] = [];
  const affected = new Set<string>();
  for (const task of followups) {
    const id = `PR-${randomUUID()}`;
    const rationale = `По задаче «${task.title}» срок ожидания ${task.next_event_at} прошёл. Подготовить уточнение поставщику или перенести срок; отправка требует решения человека.`;
    const sources = [`task:${task.id}`, `task_version:${task.version}`];
    database.prepare(`INSERT INTO proposal (id,kind,subject_type,subject_id,subject_version,payload,affects,state,rationale_ru,sources,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(id, "clarification", "task", task.id, task.version,
      JSON.stringify({ task_id: task.id, task_version: task.version, alternative: "перенести срок" }),
      JSON.stringify([task.id]), "needs_review", rationale, JSON.stringify(sources), at);
    bumpStateVersion(database);
    proposals.push(id);
    await recordActionIn(runId, { kind: "escalation", subject_ref: id, summary_ru: `Нужно уточнение по задаче ${task.id}`,
      rationale_ru: rationale, sources, autonomy: "escalated", result: "needs_owner",
      idempotency_key: `schedule:followup:${task.id}:${task.version}` }, database);
  }
  for (const row of crossing) {
    const components = JSON.parse(row.components) as Record<string, unknown>;
    components.urgency = "critical";
    database.prepare("UPDATE recommendation SET urgency='critical',components=?,version=version+1 WHERE id=? AND urgency IN ('soon','normal')")
      .run(JSON.stringify(components), row.id);
    bumpStateVersion(database);
    affected.add(row.code_1c);
    await recordActionIn(runId, { kind: "status_change", subject_ref: row.id, code_1c: row.code_1c,
      summary_ru: `Критичный срок пополнения ${row.code_1c}`, rationale_ru: `Покрытие остатком пересекло срок поставки ${row.lead_time_days} дн.`,
      sources: [`recommendation:${row.id}`], autonomy: "auto", idempotency_key: `schedule:critical:${row.id}` }, database);
  }
  const runs: string[] = [];
  if (staleCodes.length) {
    const result = await runCalculation({ codes: staleCodes }, {}, { database, org_id: orgId, as_of: at });
    runs.push(result.run_id);
    for (const code of staleCodes) affected.add(code);
  }
  await finishRunIn(runId, "done", database);
  return { runs: [runId, ...runs], processed: followups.length + crossing.length + staleCodes.length, proposals, affected: [...affected] };
}
