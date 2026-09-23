import { db } from "../db/client";
import { recordAction } from "../server/ledger";
import { decide } from "./decisions";

export interface OutlierDecision {
  answer: "one_off" | "regular" | null;
  result_state: "decided" | "insufficient" | "unsupported" | "provider_error";
  provider: string;
  model_version?: string;
  decision_record_id?: string;
}

function numberFrom(input: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = Number(input[key]);
    if (Number.isFinite(value)) return value;
  }
  return NaN;
}

/** Semantic review only near the rule boundary. The engine owns exclusion. */
export async function judgeOutlier(doc: unknown, stats: unknown): Promise<OutlierDecision> {
  const item = doc && typeof doc === "object" ? doc as Record<string, unknown> : {};
  const values = stats && typeof stats === "object" ? stats as Record<string, unknown> : {};
  const qty = numberFrom(item, "qty", "document_qty");
  const threshold = numberFrom(values, "threshold");
  if (!Number.isFinite(qty) || !Number.isFinite(threshold) || threshold <= 0) {
    return { answer: null, result_state: "insufficient", provider: "rule-boundary" };
  }
  const lower = numberFrom(values, "lower_threshold");
  const upper = numberFrom(values, "upper_threshold");
  const low = Number.isFinite(lower) ? lower : threshold * 0.8;
  const high = Number.isFinite(upper) ? upper : threshold * 1.2;
  if (qty < low || qty > high) {
    return { answer: qty > threshold ? "one_off" : "regular", result_state: "decided", provider: "deterministic-rule", model_version: "boundary-v1" };
  }
  const subject = String(item.doc_no ?? item.id ?? "");
  if (!subject) return { answer: null, result_state: "insufficient", provider: "rule-boundary" };
  const record = await decide("one_off_order", subject, {
    document_qty: qty, threshold, text: String(item.text ?? ""),
    code_1c: item.code_1c, doc_no: subject, org_id: item.org_id,
    subject_versions: values.subject_versions,
  });
  return {
    answer: record.answer === "one_off" || record.answer === "regular" ? record.answer : null,
    result_state: record.result_state, provider: record.provider, model_version: record.model_version,
    decision_record_id: record.id,
  };
}

/** Short factual text for ledger/voice; the typed judgment supplies only direction. */
export async function summarizeChanges(run_id: string): Promise<string> {
  const d = db();
  const run = d.prepare("SELECT id,agent_run_id FROM calc_run WHERE id=?").get(run_id) as { id: string; agent_run_id: string | null } | undefined;
  if (!run) return "Расчёт не найден.";
  const previous = d.prepare("SELECT id FROM calc_run WHERE rowid < (SELECT rowid FROM calc_run WHERE id=?) ORDER BY rowid DESC LIMIT 1").get(run_id) as { id: string } | undefined;
  if (!previous) return "Первый расчёт; сравнение пока недоступно.";
  const total = (id: string) => (d.prepare("SELECT COALESCE(SUM(qty_recommended),0) AS qty FROM recommendation WHERE run_id=?").get(id) as { qty: number }).qty;
  const before = total(previous.id);
  const after = total(run_id);
  const judgment = await decide("change_summary", run_id, { previous: { qty: before }, current: { qty: after } });
  if (run.agent_run_id) await recordAction(run.agent_run_id, {
    kind: "decision", subject_ref: run_id,
    summary_ru: `Изменение расчёта: ${judgment.answer ?? judgment.result_state}`,
    rationale_ru: `provider=${judgment.provider}; model=${judgment.model_version}; state=${judgment.result_state}`,
    sources: [previous.id, run_id, judgment.id], provider: judgment.provider, model_version: judgment.model_version,
    idempotency_key: `change_summary:${run_id}`,
  });
  if (judgment.result_state === "provider_error") throw new Error("provider_error:change_summary");
  const direction = judgment.answer === "increased" ? "вырос" : judgment.answer === "decreased" ? "снизился" : judgment.answer === "unchanged" ? "не изменился" : "требует сравнения";
  return `Общий рекомендуемый объём ${direction}: ${before} → ${after} шт. Источник: расчёты ${previous.id} и ${run_id}.`;
}
