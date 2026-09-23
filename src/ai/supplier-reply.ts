import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import { db, bumpStateVersion, withTx } from "../db/client";
import { recordAction } from "../server/ledger";
import { interpretSupplierReply, type SupplierReplyDecision } from "./interpret";

type Line = { code_1c: string; qty: number; unit_cost: string | null; rationale_ru: string | null; recommendation_id: string | null };
type Part = { eta: string; lines: Line[]; total_qty: number; total_cost: string | null; prepayment: string | null; balance: string | null };

function part(eta: string, lines: Line[]): Part {
  const known = lines.every(line => line.unit_cost !== null);
  const total = known ? lines.reduce((sum, line) => sum.plus(new Decimal(line.unit_cost!).times(line.qty)), new Decimal(0)).toDecimalPlaces(2) : null;
  const prepayment = total?.times(0.3).toDecimalPlaces(2, Decimal.ROUND_HALF_UP) ?? null;
  return { eta, lines, total_qty: lines.reduce((sum, line) => sum + line.qty, 0),
    total_cost: total?.toFixed(2) ?? null, prepayment: prepayment?.toFixed(2) ?? null,
    balance: total && prepayment ? total.minus(prepayment).toFixed(2) : null };
}

export function splitLines(lines: Line[], decision: SupplierReplyDecision, now: string): { now: Part; later: Part } {
  const affected = new Set(decision.affected_lines);
  const relevant = lines.map((line, index) => ({ line, index })).filter(row => affected.has(row.line.code_1c));
  const total = relevant.reduce((sum, row) => sum + row.line.qty, 0);
  const shipped = decision.partial_qty ?? Math.round(total * Number(decision.partial_share));
  if (!total || !Number.isSafeInteger(shipped) || shipped < 1 || shipped >= total || !decision.promised_eta)
    throw new Error("invalid_partial_delivery");
  const shares = relevant.map(row => ({ index: row.index, raw: row.line.qty * shipped / total }));
  const allocated = new Map(shares.map(row => [row.index, Math.floor(row.raw)]));
  const left = shipped - [...allocated.values()].reduce((sum, qty) => sum + qty, 0);
  shares.sort((a, b) => (b.raw % 1) - (a.raw % 1) || a.index - b.index);
  for (const row of shares.slice(0, left)) allocated.set(row.index, allocated.get(row.index)! + 1);
  const first = lines.map((line, index) => ({ ...line, qty: affected.has(line.code_1c) ? allocated.get(index)! : line.qty })).filter(line => line.qty > 0);
  const remainder = lines.map((line, index) => ({ ...line, qty: affected.has(line.code_1c) ? line.qty - allocated.get(index)! : 0 })).filter(line => line.qty > 0);
  return { now: part(now, first), later: part(decision.promised_eta, remainder) };
}

export async function proposeSupplierReply(row: {
  id: string; org_id: string; source_id: string; po_id: string | null; actor_id: string | null;
  at: string | null; text: string | null;
}, payload: Record<string, unknown>, runId: string): Promise<string | null> {
  const poId = row.po_id || (typeof payload.po_id === "string" ? payload.po_id : null);
  const text = row.text || (typeof payload.text === "string" ? payload.text : "");
  if (!poId || !text) throw new Error("supplier_reply_missing_order");
  const order = db().prepare("SELECT id,supplier_id,state,version,total_qty,total_cost,eta FROM purchase_order WHERE id=?").get(poId) as
    { id: string; supplier_id: string; state: string; version: number; total_qty: number; total_cost: string | null; eta: string | null } | undefined;
  if (!order || order.state !== "approved" || (row.actor_id && row.actor_id !== order.supplier_id) ||
      (payload.supplier_id && payload.supplier_id !== order.supplier_id)) throw new Error("supplier_reply_order_mismatch");
  const lines = db().prepare("SELECT code_1c,qty,unit_cost,rationale_ru,recommendation_id FROM purchase_order_line WHERE po_id=? ORDER BY id")
    .all(poId) as Line[];
  if (!lines.length) throw new Error("supplier_reply_empty_order");
  const codes = Array.isArray(payload.affected_lines) ? payload.affected_lines : lines.map(line => line.code_1c);
  if (!codes.length || codes.some(code => typeof code !== "string" || !lines.some(line => line.code_1c === code)))
    throw new Error("supplier_reply_lines_mismatch");
  const id = `PR-${createHash("sha256").update(`${row.org_id}:${row.source_id}:supplier_reply`).digest("hex").slice(0, 24)}`;
  const existing = db().prepare("SELECT id,kind,rationale_ru FROM proposal WHERE id=?").get(id) as
    { id: string; kind: string; rationale_ru: string } | undefined;
  if (existing) {
    await recordAction(runId, { kind: "escalation", subject_ref: id, po_id: poId, world_event_id: row.id,
      summary_ru: existing.kind === "supplier_split" ? `Подготовлено разделение заказа ${poId}; требуется ваше решение` : `Подготовлено ускорение заказа ${poId}; требуется ваше решение`,
      rationale_ru: existing.rationale_ru, sources: [row.id, id], autonomy: "escalated", result: "needs_owner",
      idempotency_key: `worker:${row.source_id}:supplier_reply:proposal` });
    return existing.id;
  }
  const decision = await interpretSupplierReply({ text, at: row.at || new Date().toISOString(), po_id: poId,
    org_id: row.org_id, affected_lines: codes as string[] });
  const routing = db().prepare("SELECT provider,model_version,task_class FROM decision_record WHERE id=?")
    .get(decision.decision_record_id) as { provider: string; model_version: string; task_class: "reasoning" };
  if (decision.action === "unknown") {
    await recordAction(runId, { kind: "escalation", subject_ref: poId, po_id: poId, world_event_id: row.id,
      summary_ru: `Ответ поставщика по заказу ${poId} требует уточнения срока и количества`,
      sources: [row.id, decision.decision_record_id], autonomy: "escalated", result: "needs_owner",
      provider: routing.provider, model_version: routing.model_version, task_class: routing.task_class,
      idempotency_key: `worker:${row.source_id}:supplier_reply:unknown` });
    return null;
  }
  const parts = decision.action === "split" ? splitLines(lines, decision, row.at || new Date().toISOString()) : null;
  const alternative = decision.action === "expedite" ? lines.filter(line => decision.affected_lines.includes(line.code_1c))
    .map(line => ({ code_1c: line.code_1c, available_supplier: (db().prepare("SELECT supplier_id FROM sku WHERE code_1c=? AND supplier_id<>?").get(line.code_1c, order.supplier_id) as { supplier_id: string } | undefined)?.supplier_id ?? null })) : [];
  const rationale = decision.action === "split"
    ? `Поставщик может отгрузить часть заказа ${poId} сейчас, остаток — ${decision.promised_eta!.slice(0, 10)}. Проверьте разделение заказа и платежи 30 % / 70 % по каждой части. Черновик не отправлен.`
    : `Поставка по заказу ${poId} задержится на ${decision.delay_days} дн. Проверьте срочность и возможность переноса позиций. Черновик не отправлен.`;
  const proposal = { id, kind: decision.action === "split" ? "supplier_split" : "supplier_expedite", subject_type: "purchase_order",
    subject_id: poId, subject_version: order.version, payload: JSON.stringify({ source_id: row.source_id, supplier_id: order.supplier_id,
      original_text: text, decision, parts, alternatives: alternative }), affects: JSON.stringify(decision.affected_lines),
    state: "needs_review", rationale_ru: rationale, sources: JSON.stringify([row.id, decision.decision_record_id, poId]),
    money_at_stake: order.total_cost ? JSON.stringify({ amount: order.total_cost, currency: "KZT" }) : null,
    created_at: new Date().toISOString() };
  withTx(tx => {
    tx.prepare(`INSERT OR IGNORE INTO proposal(id,kind,subject_type,subject_id,subject_version,payload,affects,state,rationale_ru,sources,money_at_stake,created_at)
      VALUES (@id,@kind,@subject_type,@subject_id,@subject_version,@payload,@affects,@state,@rationale_ru,@sources,@money_at_stake,@created_at)`).run(proposal);
    tx.prepare("UPDATE world_event SET text=? WHERE id=?").run(`${text} Предложение: ${decision.action === "split" ? "разделить заказ на поставку сейчас и остаток к обещанному сроку" : "ускорить поставку и проверить другой источник"}.`, row.id);
    bumpStateVersion(tx);
  });
  await recordAction(runId, { kind: "escalation", subject_ref: id, po_id: poId, world_event_id: row.id,
    summary_ru: decision.action === "split" ? `Подготовлено разделение заказа ${poId}; требуется ваше решение` : `Подготовлено ускорение заказа ${poId}; требуется ваше решение`,
    rationale_ru: rationale, sources: [row.id, decision.decision_record_id, id], autonomy: "escalated", result: "needs_owner",
    provider: routing.provider, model_version: routing.model_version, task_class: routing.task_class,
    idempotency_key: `worker:${row.source_id}:supplier_reply:proposal` });
  return id;
}
