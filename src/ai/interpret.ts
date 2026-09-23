import { db } from "../db/client";
import { recordAction } from "../server/ledger";
import { decide, decisionRoute } from "./decisions";
import { catalogQuestion } from "./catalog";
import { decideChoice } from "./provider";

export interface SupplierReplyDecision {
  action: "split" | "expedite" | "unknown";
  partial_share: string | null;
  partial_qty: number | null;
  delay_days: number | null;
  promised_eta: string | null;
  affected_lines: string[];
  decision_record_id: string;
}

/** Typed extraction keeps quantities and dates under deterministic validation. */
export async function interpretSupplierReply(input: {
  text: string; at: string; po_id: string; org_id: string; affected_lines: string[];
}): Promise<SupplierReplyDecision> {
  const text = input.text.toLowerCase().replace(/\u00a0/g, " ");
  const shareMatch = text.match(/(\d+(?:[,.]\d+)?)\s*%/);
  const qtyMatch = text.match(/(\d[\d\s]*)\s*шт/i) ?? text.match(/(\d[\d\s]*)\s*из\s*\d+/i);
  const partialShare = shareMatch ? Number(shareMatch[1].replace(",", ".")) / 100 : null;
  const partialQty = !shareMatch && qtyMatch ? Number(qtyMatch[1].replace(/\s/g, "")) : null;
  const base = new Date(input.at);
  if (!Number.isFinite(base.getTime())) throw new Error("invalid_reply_date");
  const weeks = text.match(/через\s+(\d+)\s*недел/);
  const days = text.match(/через\s+(\d+)\s*(?:дн|день|дня)/);
  const until = text.match(/до\s+(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?/);
  let eta: Date | null = null;
  if (weeks || days) {
    eta = new Date(base);
    eta.setUTCDate(eta.getUTCDate() + Number(weeks?.[1] ?? days?.[1]) * (weeks ? 7 : 1));
  } else if (until) {
    const year = until[3] ? Number(until[3]) : base.getUTCFullYear();
    eta = new Date(Date.UTC(year, Number(until[2]) - 1, Number(until[1])));
    if (eta.getUTCDate() !== Number(until[1]) || eta.getUTCMonth() !== Number(until[2]) - 1) eta = null;
    else if (!until[3] && eta.getTime() < base.getTime()) eta.setUTCFullYear(year + 1);
  }
  const delayDays = eta ? Math.ceil((eta.getTime() - base.getTime()) / 86_400_000) : null;
  const context = { text: input.text, org_id: input.org_id, po_id: input.po_id };
  const record = await decide("supplier_fulfilment", input.po_id, context);
  const fallback = record.result_state === "decided" ? null : await decideChoice(catalogQuestion("supplier_fulfilment")!, context, decisionRoute, "rules");
  const chosen = fallback?.answer ?? record.answer;
  const hasPartial = (partialShare !== null && partialShare > 0 && partialShare < 1)
    || (partialQty !== null && Number.isSafeInteger(partialQty) && partialQty > 0);
  const action = chosen === "split" && hasPartial && delayDays !== null && delayDays > 0 ? "split"
    : (chosen === "expedite" || (chosen === "split" && !hasPartial)) && delayDays !== null && delayDays > 0 ? "expedite" : "unknown";
  return {
    action, partial_share: partialShare !== null && partialShare > 0 && partialShare < 1 ? String(partialShare) : null,
    partial_qty: partialQty !== null && Number.isSafeInteger(partialQty) && partialQty > 0 ? partialQty : null,
    delay_days: delayDays !== null && delayDays > 0 ? delayDays : null,
    promised_eta: eta && delayDays !== null && delayDays > 0 ? eta.toISOString() : null,
    affected_lines: [...new Set(input.affected_lines)], decision_record_id: record.id,
  };
}

export interface OutlierDecision {
  answer: "one_off" | "regular" | null;
  result_state: "decided" | "insufficient" | "unsupported" | "provider_error";
  provider: string;
  model_version?: string;
  task_class?: "reasoning";
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
    median_month_qty: values.median_month_qty, p95_doc_qty: values.p95_doc_qty,
    code_1c: item.code_1c, doc_no: subject, org_id: item.org_id,
    subject_versions: values.subject_versions,
  }, { fallback_to_rules: true });
  return {
    answer: record.answer === "one_off" || record.answer === "regular" ? record.answer : null,
    result_state: record.result_state, provider: record.provider, model_version: record.model_version, task_class: "reasoning",
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
  const judgment = await decide("change_summary", run_id, { previous: { qty: before }, current: { qty: after } }, { fallback_to_rules: true });
  if (run.agent_run_id) await recordAction(run.agent_run_id, {
    kind: "decision", subject_ref: run_id,
    summary_ru: `Изменение расчёта: ${judgment.answer ?? judgment.result_state}`,
    rationale_ru: judgment.provider === "rules" ? "Изменение проверено по установленным правилам." : "Изменение проверено по расчётам.",
    sources: [previous.id, run_id, judgment.id], provider: judgment.provider, model_version: judgment.model_version, task_class: judgment.task_class,
    idempotency_key: `change_summary:${run_id}`,
  });
  if (judgment.result_state === "provider_error") throw new Error("provider_error:change_summary");
  const direction = judgment.answer === "increased" ? "вырос" : judgment.answer === "decreased" ? "снизился" : judgment.answer === "unchanged" ? "не изменился" : "требует сравнения";
  return `Общий рекомендуемый объём ${direction}: ${before} → ${after} шт. Источник: расчёты ${previous.id} и ${run_id}.`;
}
