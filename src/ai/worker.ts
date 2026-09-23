import { randomUUID } from "node:crypto";
import { db, bumpStateVersion, withTx } from "../db/client";
import { applyWorldEvent } from "../domain/events";
import { computeNeed, type EngineParams } from "../domain/engine";
import { paramsForSupplier } from "../domain/params";
import { applyRecommendations } from "../domain/apply";
import { startRun, recordAction, finishRun } from "../server/ledger";
import { decide } from "./decisions";
import { judgeOutlier, summarizeChanges } from "./interpret";

export interface ProcessResult { run_id: string | null; actions: number; escalations: number; reason?: string }
export interface TickResult { runs: string[]; processed: number }
interface EventRow { id: string; org_id: string; seq: number | null; kind: string; code_1c: string | null; po_id: string | null; source_id: string; text: string | null; payload: string; at: string | null; state: string; run_id: string | null }
const processing = new Map<string, Promise<ProcessResult>>();
let ticking: Promise<TickResult> | null = null;

function eventPayload(row: EventRow): Record<string, unknown> {
  const parsed: unknown = JSON.parse(row.payload);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_event_payload");
  return parsed as Record<string, unknown>;
}

function domainEvent(row: EventRow, payload: Record<string, unknown>, runId: string) {
  if (row.kind !== "judge_message") return { ...row, run_id: runId };
  if (payload.action === "inject_sales_line" && payload.line && typeof payload.line === "object") {
    return { ...row, run_id: runId, payload: JSON.stringify(payload.line) };
  }
  if (payload.action === "adjust_in_transit") {
    return { ...row, kind: "in_transit_update", run_id: runId, payload: JSON.stringify({
      code_1c: payload.code_1c ?? row.code_1c, delta: payload.delta_qty, po_ref: row.source_id,
    }) };
  }
  if (payload.action === "update_unit_cost") {
    return { ...row, kind: "price_update", run_id: runId, payload: JSON.stringify({
      code_1c: payload.code_1c ?? row.code_1c, unit_cost: payload.to,
    }) };
  }
  return { ...row, run_id: runId };
}

async function recordDecision(runId: string, eventId: string, question: string, subject: string, context: Record<string, unknown>): Promise<void> {
  const result = await decide(question, subject, context);
  await recordAction(runId, {
    kind: "decision", subject_ref: subject, world_event_id: eventId,
    summary_ru: `Решение ${question}: ${result.answer ?? result.result_state}`,
    rationale_ru: `provider=${result.provider}; model=${result.model_version}; state=${result.result_state}`,
    sources: [result.id, ...Object.keys(result.evidence_versions)], provider: result.provider, model_version: result.model_version,
    autonomy: "auto", idempotency_key: `${eventId}:decision:${question}:${subject}`,
  });
  if (result.result_state === "provider_error") throw new Error(`provider_error:${question}`);
}

async function maybeSemanticDecisions(row: EventRow, payload: Record<string, unknown>, runId: string): Promise<void> {
  const text = row.text || String(payload.text || "");
  if (row.kind === "supplier_reply" && text) {
    await recordDecision(runId, row.id, "supplier_terms_hint", row.po_id || row.source_id, { text, org_id: row.org_id });
  }
  if (row.kind === "judge_message") {
    const qty = Number(payload.document_qty ?? payload.qty);
    const threshold = Number(payload.threshold);
    if (Number.isFinite(qty) && Number.isFinite(threshold) && threshold > 0) {
      const judgment = await judgeOutlier({
        qty, doc_no: payload.doc_no || row.source_id, code_1c: row.code_1c, text, org_id: row.org_id,
      }, { threshold });
      await recordAction(runId, {
        kind: "decision", subject_ref: String(payload.doc_no || row.source_id), world_event_id: row.id,
        summary_ru: `Проверка разового заказа: ${judgment.answer ?? judgment.result_state}`,
        rationale_ru: `provider=${judgment.provider}; model=${judgment.model_version || "none"}`,
        sources: judgment.decision_record_id ? [judgment.decision_record_id] : [row.id],
        provider: judgment.provider, model_version: judgment.model_version,
        idempotency_key: `${row.id}:decision:one_off_order`,
      });
      if (judgment.result_state === "provider_error") throw new Error("provider_error:one_off_order");
    }
  }
  if (payload.urgency_reason && row.code_1c) {
    await recordDecision(runId, row.id, "urgency_override_reason", row.code_1c, { text: String(payload.urgency_reason), org_id: row.org_id });
  }
}

async function recomputeAffected(row: EventRow, codes: string[], runId: string): Promise<string | null> {
  const unique = [...new Set(codes.filter(Boolean))];
  if (!unique.length) return null;
  const d = db();
  const computed: { code: string; supplier: string; result: Awaited<ReturnType<typeof computeNeed>> }[] = [];
  for (const code of unique) {
    const supplier = d.prepare("SELECT supplier_id FROM sku WHERE code_1c=?").get(code) as { supplier_id: string } | undefined;
    if (!supplier) throw new Error(`sku_not_found:${code}`);
    const params: EngineParams = paramsForSupplier(supplier.supplier_id, d);
    const result = await computeNeed(code, params, { as_of: row.at || undefined });
    if (!result.forecast) throw new Error(`engine_unavailable:${code}`);
    computed.push({ code, supplier: supplier.supplier_id, result });
  }
  const calcId = `RUN-${randomUUID()}`;
  const now = new Date().toISOString();
  withTx(tx => {
    tx.prepare("INSERT INTO calc_run(id,scope,params,started_at,finished_at,skus,recommended,agent_run_id) VALUES (?,?,?,?,?,?,?,?)")
      .run(calcId, JSON.stringify({ codes: unique }), "{}", now, now, unique.length, computed.filter(c => c.result.need > 0).length, runId);
    for (const { code, supplier, result } of computed) {
      const forecastId = `FC-${randomUUID()}`;
      const forecast = result.forecast!;
      tx.prepare(`INSERT INTO forecast(id,run_id,code_1c,horizon_months,base_rate,season,growth,stockout_uplift,safety,method_ru)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(forecastId, calcId, code, Number(forecast.horizon_months), String(forecast.base_rate),
          JSON.stringify(forecast.season || {}), String(forecast.growth), String(forecast.stockout_uplift), String(forecast.safety), String(forecast.method_ru || ""));
      tx.prepare(`INSERT INTO recommendation(id,run_id,code_1c,supplier_id,qty_recommended,on_hand,in_transit,forecast_id,urgency,rationale_ru,components)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(`REC-${randomUUID()}`, calcId, code, supplier, result.need,
          String(result.components.on_hand ?? "0"), String(result.components.in_transit ?? "0"), forecastId,
          String(result.components.urgency ?? "none"), result.rationale_ru, JSON.stringify(result.components));
    }
    bumpStateVersion(tx);
  });
  for (const { code, result } of computed) {
    await recordAction(runId, {
      kind: "recompute", subject_ref: code, code_1c: code, world_event_id: row.id,
      summary_ru: `Пересчитана потребность ${code}: ${result.need} шт`, rationale_ru: result.rationale_ru,
      sources: [row.id, `sku:${code}`, "sales_month", "stock_month", "in_transit"],
      idempotency_key: `${row.id}:recompute:${code}`,
    });
    const sku = d.prepare("SELECT supplier_id,name,category FROM sku WHERE code_1c=?").get(code) as { supplier_id: string; name: string; category: string | null } | undefined;
    if (sku?.supplier_id === "IEK" && !sku.category) {
      await recordDecision(runId, row.id, "category_hint", code, { name: sku.name, org_id: row.org_id });
    }
  }
  const applied = await applyRecommendations(calcId);
  await recordAction(runId, {
    kind: "status_change", subject_ref: calcId, world_event_id: row.id,
    summary_ru: `Созданы предложения поставщикам: ${applied.proposals.length}`,
    sources: applied.proposals.map(p => p && typeof p === "object" && "id" in p ? String(p.id) : calcId),
    idempotency_key: `${row.id}:proposals`,
  });
  const summary = await summarizeChanges(calcId);
  await recordAction(runId, {
    kind: "status_change", subject_ref: calcId, world_event_id: row.id, summary_ru: summary,
    sources: [calcId], idempotency_key: `${row.id}:change_summary`,
  });
  return calcId;
}

async function runEvent(id: string): Promise<ProcessResult> {
  const row = db().prepare("SELECT * FROM world_event WHERE id=?").get(id) as EventRow | undefined;
  if (!row) return { run_id: null, actions: 0, escalations: 0, reason: "world_event_not_found" };
  if (row.state !== "pending" || row.run_id) return { run_id: row.run_id, actions: 0, escalations: 0, reason: `already_${row.state}` };
  const runId = await startRun({ org_id: row.org_id, trigger_type: "world_event", trigger_ref: row.id });
  const claimed = withTx(tx => {
    const result = tx.prepare("UPDATE world_event SET run_id=? WHERE id=? AND state='pending' AND run_id IS NULL").run(runId, id);
    if (result.changes) bumpStateVersion(tx);
    return result;
  });
  if (!claimed.changes) {
    await finishRun(runId, "failed");
    return { run_id: null, actions: 0, escalations: 0, reason: "claimed_by_another_worker" };
  }
  try {
    const payload = eventPayload(row);
    const sourceRow = domainEvent(row, payload, runId);
    const applied = await applyWorldEvent(sourceRow);
    if (!applied.applied && applied.reason !== "replayed") throw new Error(applied.reason || "event_not_applied");
    await recordAction(runId, {
      kind: "status_change", subject_ref: row.id, world_event_id: row.id,
      summary_ru: `Событие ${row.kind} применено`, sources: [row.source_id], idempotency_key: `${row.id}:applied`,
    });
    await maybeSemanticDecisions(row, payload, runId);
    await recomputeAffected(row, applied.affected_codes, runId);
    withTx(tx => {
      tx.prepare("UPDATE world_event SET state='processed',run_id=?,processed_at=? WHERE id=?").run(runId, new Date().toISOString(), id);
      bumpStateVersion(tx);
    });
    await finishRun(runId, "done");
    const count = db().prepare("SELECT actions_count,escalations_count FROM agent_run WHERE id=?").get(runId) as { actions_count: number; escalations_count: number } | undefined;
    return { run_id: runId, actions: count?.actions_count ?? 0, escalations: count?.escalations_count ?? 0 };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "worker_failed";
    await recordAction(runId, {
      kind: "escalation", subject_ref: row.id, world_event_id: row.id,
      summary_ru: `Событие требует проверки: ${reason}`, rationale_ru: reason,
      sources: [row.source_id], autonomy: "escalated", result: "failed", idempotency_key: `${row.id}:failed`,
    });
    withTx(tx => {
      tx.prepare("UPDATE world_event SET state='failed',run_id=?,processed_at=? WHERE id=?").run(runId, new Date().toISOString(), id);
      bumpStateVersion(tx);
    });
    await finishRun(runId, "failed");
    const count = db().prepare("SELECT actions_count,escalations_count FROM agent_run WHERE id=?").get(runId) as { actions_count: number; escalations_count: number } | undefined;
    return { run_id: runId, actions: count?.actions_count ?? 0, escalations: count?.escalations_count ?? 0, reason };
  }
}

export function processEvent(world_event_id: string): Promise<ProcessResult> {
  const existing = processing.get(world_event_id);
  if (existing) return existing;
  const work = runEvent(world_event_id).finally(() => { processing.delete(world_event_id); });
  processing.set(world_event_id, work);
  return work;
}

export async function runScheduledChecks(now: Date = new Date()): Promise<string[]> {
  const due = db().prepare("SELECT id,title FROM task WHERE next_event_at IS NOT NULL AND next_event_at<=? AND state IN ('awaiting_supplier','needs_review') ORDER BY next_event_at,id")
    .all(now.toISOString()) as { id: string; title: string }[];
  const org = (db().prepare("SELECT id FROM organization LIMIT 1").get() as { id: string } | undefined)?.id || "ORG-1";
  const runs: string[] = [];
  for (const task of due) {
    const runId = await startRun({ org_id: org, trigger_type: "scheduled_check", trigger_ref: task.id });
    await recordAction(runId, {
      kind: "escalation", subject_ref: task.id, summary_ru: `Срок проверки: ${task.title}`,
      sources: [task.id], autonomy: "escalated", result: "needs_owner", idempotency_key: `scheduled:${task.id}:${now.toISOString()}`,
    });
    withTx(tx => {
      tx.prepare("UPDATE task SET next_event_at=NULL,updated_at=? WHERE id=?").run(now.toISOString(), task.id);
      bumpStateVersion(tx);
    });
    await finishRun(runId, "done");
    runs.push(runId);
  }
  return runs;
}

export function tick(): Promise<TickResult> {
  if (ticking) return ticking;
  ticking = (async () => {
    const pending = db().prepare("SELECT id FROM world_event WHERE state='pending' AND run_id IS NULL ORDER BY seq,id").all() as { id: string }[];
    const runs: string[] = [];
    let processed = 0;
    for (const event of pending) {
      const result = await processEvent(event.id);
      if (result.run_id) runs.push(result.run_id);
      if (!result.reason) processed++;
    }
    runs.push(...await runScheduledChecks(new Date()));
    return { runs, processed };
  })().finally(() => { ticking = null; });
  return ticking;
}
