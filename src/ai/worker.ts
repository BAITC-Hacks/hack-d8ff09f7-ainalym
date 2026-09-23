import { randomUUID } from "node:crypto";
import { db, bumpStateVersion, withTx } from "../db/client";
import { applyWorldEvent } from "../domain/events";
import { recomputeAffected as domainRecompute } from "../domain/recompute";
import { computeNeed } from "../domain/engine";
import { paramsForSupplier } from "../domain/params";
import { startRun, recordAction, finishRun } from "../server/ledger";
import { decide } from "./decisions";
import { judgeOutlier, summarizeChanges } from "./interpret";
import { proposeSupplierReply } from "./supplier-reply";

export interface ProcessResult { run_id: string | null; actions: number; escalations: number; reason?: string }
export interface TickResult { runs: string[]; processed: number }
interface EventRow { id: string; org_id: string; seq: number | null; kind: string; actor_id: string | null; code_1c: string | null; po_id: string | null; source_id: string; text: string | null; payload: string; at: string | null; state: string; run_id: string | null; claimed_at: string | null; attempt: number; processing_stage: string; affected_codes: string }
const CLAIM_TIMEOUT_MS = 5 * 60_000;
const processing = new Map<string, Promise<ProcessResult>>();
const ticking = new Map<string, Promise<TickResult>>();

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
    autonomy: "auto", idempotency_key: `worker:${eventId}:decision:${question}:${subject}`,
  });
  if (result.result_state === "provider_error") throw new Error(`provider_error:${question}`);
}

async function proposeOutlierReview(row: EventRow, runId: string, subject: string, answer: string | null, decisionId: string, at: string): Promise<void> {
  const ym = at.slice(0, 7);
  if (!row.code_1c || !/^\d{4}-\d{2}$/.test(ym) || (answer !== "one_off" && answer !== "regular")) {
    await recordAction(runId, {
      kind: "escalation", subject_ref: subject, world_event_id: row.id,
      summary_ru: `Пограничный документ ${subject} требует ручной проверки исходных данных`,
      sources: [row.id, decisionId], autonomy: "escalated", result: "needs_owner",
      idempotency_key: `worker:${row.id}:outlier_missing_inputs:${subject}`,
    });
    return;
  }
  const existing = db().prepare("SELECT id FROM proposal WHERE kind='outlier_review' AND subject_id=? AND state='needs_review' LIMIT 1")
    .get(subject) as { id: string } | undefined;
  const proposalId = existing?.id || `PR-${randomUUID()}`;
  if (!existing) withTx(tx => {
    const version = row.code_1c ? (tx.prepare("SELECT version FROM sku WHERE code_1c=?").get(row.code_1c) as { version: number } | undefined)?.version : undefined;
    tx.prepare(`INSERT INTO proposal(id,kind,subject_type,subject_id,subject_version,payload,affects,state,rationale_ru,sources,created_at)
      VALUES (?,'outlier_review','sales_document',?,?,?,?, 'needs_review',?,?,?)`).run(
        proposalId, subject, version ?? null, JSON.stringify({ answer, decision_record_id: decisionId,
          doc_no: subject, code_1c: row.code_1c, ym, state: answer === "one_off" ? "excluded" : "kept" }),
        JSON.stringify([row.code_1c]),
        `Пограничный разовый заказ ${subject}: решение AI — ${answer ?? "не определено"}. Подтвердите исключение или сохранение.`,
        JSON.stringify([row.id, decisionId]), new Date().toISOString(),
      );
    bumpStateVersion(tx);
  });
  await recordAction(runId, {
    kind: "escalation", subject_ref: proposalId, world_event_id: row.id, code_1c: row.code_1c || undefined,
    summary_ru: `Требуется решение по разовому документу ${subject}`,
    sources: [row.id, decisionId, proposalId], autonomy: "escalated", result: "needs_owner",
    idempotency_key: `worker:${row.id}:outlier_review:${subject}`,
  });
}

interface PendingOutlierReview { subject: string; answer: string | null; decisionId: string; at: string }

async function maybeSemanticDecisions(row: EventRow, payload: Record<string, unknown>, runId: string): Promise<PendingOutlierReview | null> {
  const text = row.text || String(payload.text || "");
  let review: PendingOutlierReview | null = null;
  if (row.kind === "judge_message") {
    const line = payload.line && typeof payload.line === "object" ? payload.line as Record<string, unknown> : {};
    const qty = Number(line.qty ?? payload.document_qty ?? payload.qty);
    if (line.qty !== undefined && payload.document_qty !== undefined && Number(line.qty) !== Number(payload.document_qty))
      throw new Error("document_quantity_mismatch");
    if (row.code_1c && Number.isFinite(qty) && qty > 0) {
      const supplier = db().prepare("SELECT supplier_id FROM sku WHERE code_1c=?").get(row.code_1c) as { supplier_id: string } | undefined;
      if (!supplier) throw new Error("outlier_sku_missing");
      const stats = (await computeNeed(row.code_1c, paramsForSupplier(supplier.supplier_id))).components;
      const threshold = Number(stats?.outlier_threshold);
      if (!Number.isFinite(threshold) || threshold <= 0) throw new Error("outlier_statistics_unavailable");
      const judgment = await judgeOutlier({
        qty, doc_no: line.doc_no || payload.doc_no || row.source_id, code_1c: row.code_1c, text, org_id: row.org_id,
      }, { threshold, median_month_qty: stats?.median_month_qty, p95_doc_qty: stats?.p95_doc_qty });
      await recordAction(runId, {
        kind: "decision", subject_ref: String(line.doc_no || payload.doc_no || row.source_id), world_event_id: row.id,
        summary_ru: `Проверка разового заказа: ${judgment.answer ?? judgment.result_state}`,
        rationale_ru: `provider=${judgment.provider}; model=${judgment.model_version || "none"}`,
        sources: judgment.decision_record_id ? [judgment.decision_record_id] : [row.id],
        provider: judgment.provider, model_version: judgment.model_version,
        idempotency_key: `worker:${row.id}:decision:one_off_order`,
      });
      if (judgment.result_state === "provider_error") throw new Error("provider_error:one_off_order");
      if (judgment.decision_record_id) review = {
        subject: String(line.doc_no || payload.doc_no || row.source_id), answer: judgment.answer,
        decisionId: judgment.decision_record_id, at: String(line.at || payload.at || row.at || ""),
      };
    }
  }
  if (payload.urgency_reason && row.code_1c) {
    await recordDecision(runId, row.id, "urgency_override_reason", row.code_1c, { text: String(payload.urgency_reason), org_id: row.org_id });
  }
  return review;
}

async function recomputeAffected(row: EventRow, codes: string[], runId: string): Promise<string | null> {
  const unique = [...new Set(codes.filter(Boolean))];
  if (!unique.length) return null;
  const d = db();
  const recomputed = await domainRecompute(unique, runId, row.id);
  if (recomputed.affected_codes.length !== unique.length) throw new Error("affected_sku_missing");
  const computed: { code: string; result: typeof recomputed.results[string] }[] = [];
  for (const code of recomputed.affected_codes) {
    const result = recomputed.results[code];
    if (!result) throw new Error(`engine_unavailable:${code}`);
    computed.push({ code, result });
  }
  const calcId = recomputed.run_id!;
  for (const { code } of computed) {
    const sku = d.prepare("SELECT supplier_id,name,category FROM sku WHERE code_1c=?").get(code) as { supplier_id: string; name: string; category: string | null } | undefined;
    if (sku?.supplier_id === "IEK" && !sku.category) {
      await recordDecision(runId, row.id, "category_hint", code, { name: sku.name, org_id: row.org_id });
    }
  }
  await recordAction(runId, {
    kind: "status_change", subject_ref: calcId, world_event_id: row.id,
    summary_ru: `Созданы предложения поставщикам: ${recomputed.proposal_ids.length}`,
    sources: recomputed.proposal_ids,
    idempotency_key: `worker:${row.id}:proposals`,
  });
  const summary = await summarizeChanges(calcId);
  await recordAction(runId, {
    kind: "status_change", subject_ref: calcId, world_event_id: row.id, summary_ru: summary,
    sources: [calcId], idempotency_key: `worker:${row.id}:change_summary`,
  });
  return calcId;
}

async function runEvent(id: string, orgId?: string): Promise<ProcessResult> {
  const row = db().prepare("SELECT * FROM world_event WHERE id=? AND (? IS NULL OR org_id=?)").get(id, orgId ?? null, orgId ?? null) as EventRow | undefined;
  if (!row) return { run_id: null, actions: 0, escalations: 0, reason: "world_event_not_found" };
  if (row.state !== "pending") return { run_id: row.run_id, actions: 0, escalations: 0, reason: `already_${row.state}` };
  const staleBefore = new Date(Date.now() - CLAIM_TIMEOUT_MS).toISOString();
  if (row.run_id && row.claimed_at && row.claimed_at > staleBefore) return { run_id: row.run_id, actions: 0, escalations: 0, reason: "already_claimed" };
  const runId = await startRun({ org_id: row.org_id, trigger_type: "world_event", trigger_ref: row.id });
  const claimed = withTx(tx => {
    const result = tx.prepare("UPDATE world_event SET run_id=?,claimed_at=?,attempt=attempt+1 WHERE id=? AND org_id=? AND state='pending' AND (run_id IS NULL OR claimed_at IS NULL OR claimed_at<=?)")
      .run(runId, new Date().toISOString(), id, row.org_id, staleBefore);
    if (result.changes) bumpStateVersion(tx);
    return result;
  });
  if (!claimed.changes) {
    await finishRun(runId, "failed");
    return { run_id: null, actions: 0, escalations: 0, reason: "claimed_by_another_worker" };
  }
  if (row.run_id && row.run_id !== runId) await finishRun(row.run_id, "failed");
  try {
    const payload = eventPayload(row);
    const review = await maybeSemanticDecisions(row, payload, runId);
    const applied = row.processing_stage === "applied"
      ? { applied: true, affected_codes: JSON.parse(row.affected_codes) as string[] }
      : await applyWorldEvent(domainEvent(row, payload, runId));
    if (!applied.applied) throw new Error("reason" in applied ? applied.reason || "event_not_applied" : "event_not_applied");
    await recordAction(runId, {
      kind: "status_change", subject_ref: row.id, world_event_id: row.id,
      summary_ru: row.kind === "supplier_reply" ? "Ответ поставщика учтён" : `Событие ${row.kind} применено`,
      sources: [row.source_id], idempotency_key: `worker:${row.id}:applied`,
    });
    if (row.kind === "supplier_reply") await proposeSupplierReply(row, payload, runId);
    if (review) await proposeOutlierReview(row, runId, review.subject, review.answer, review.decisionId, review.at);
    await recomputeAffected(row, applied.affected_codes, runId);
    withTx(tx => {
      tx.prepare("UPDATE world_event SET state='processed',processing_stage='finished',run_id=?,processed_at=? WHERE id=?").run(runId, new Date().toISOString(), id);
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
      sources: [row.source_id], autonomy: "escalated", result: "failed", idempotency_key: `worker:${row.id}:failed`,
    });
    withTx(tx => {
      tx.prepare("UPDATE world_event SET state='failed',processing_stage='finished',run_id=?,processed_at=? WHERE id=?").run(runId, new Date().toISOString(), id);
      bumpStateVersion(tx);
    });
    await finishRun(runId, "failed");
    const count = db().prepare("SELECT actions_count,escalations_count FROM agent_run WHERE id=?").get(runId) as { actions_count: number; escalations_count: number } | undefined;
    return { run_id: runId, actions: count?.actions_count ?? 0, escalations: count?.escalations_count ?? 0, reason };
  }
}

export function processEvent(world_event_id: string, orgId?: string): Promise<ProcessResult> {
  const key = `${orgId ?? "*"}:${world_event_id}`;
  const existing = processing.get(key);
  if (existing) return existing;
  const work = runEvent(world_event_id, orgId).finally(() => { processing.delete(key); });
  processing.set(key, work);
  return work;
}

export async function runScheduledChecks(now: Date = new Date()): Promise<string[]> {
  const due = db().prepare("SELECT id,title,next_event_at FROM task WHERE next_event_at IS NOT NULL AND next_event_at<=? AND state IN ('awaiting_supplier','needs_review') ORDER BY next_event_at,id")
    .all(now.toISOString()) as { id: string; title: string; next_event_at: string }[];
  const org = (db().prepare("SELECT id FROM organization LIMIT 1").get() as { id: string } | undefined)?.id || "ORG-1";
  const runs: string[] = [];
  for (const task of due) {
    const runId = await startRun({ org_id: org, trigger_type: "scheduled_check", trigger_ref: task.id });
    await recordAction(runId, {
      kind: "escalation", subject_ref: task.id, summary_ru: `Срок проверки: ${task.title}`,
      sources: [task.id], autonomy: "escalated", result: "needs_owner", idempotency_key: `worker:scheduled:${task.id}:${task.next_event_at}`,
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

export function tick(orgId?: string): Promise<TickResult> {
  const key = orgId ?? "*";
  const active = ticking.get(key);
  if (active) return active;
  const work = (async () => {
    const runs: string[] = [];
    let processed = 0;
    while (true) {
      const event = db().prepare("SELECT id FROM world_event WHERE state='pending' AND (run_id IS NULL OR claimed_at IS NULL OR claimed_at<=?) AND (? IS NULL OR org_id=?) ORDER BY seq,id LIMIT 1")
        .get(new Date(Date.now() - CLAIM_TIMEOUT_MS).toISOString(), orgId ?? null, orgId ?? null) as { id: string } | undefined;
      if (!event) break;
      const result = await processEvent(event.id, orgId);
      if (result.run_id) runs.push(result.run_id);
      if (!result.reason) processed++;
      if (result.reason === "claimed_by_another_worker") break;
    }
    if (!orgId) runs.push(...await runScheduledChecks(new Date()));
    return { runs, processed };
  })().finally(() => { ticking.delete(key); });
  ticking.set(key, work);
  return work;
}
