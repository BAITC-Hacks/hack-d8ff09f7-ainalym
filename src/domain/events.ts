import Decimal from "decimal.js";
import { db, bumpStateVersion, withTx } from "../db/client";
import { startRun, recordAction, finishRun, type ActionInput } from "../server/ledger";
import type { DatabaseSync } from "node:sqlite";
import { Money } from "./money";

export interface WorldEventRow { id: string; kind: string; org_id?: string; source_id?: string; code_1c?: string | null; payload: string | Record<string, unknown>; text?: string | null; at?: string | null; run_id?: string | null }
export interface ApplyEventResult { applied: boolean; affected_codes: string[]; actions: ActionInput[]; escalations: ActionInput[]; reason?: string }
type P = Record<string, unknown>;

function codeFor(item: P, event: WorldEventRow): string {
  return String(item.code_1c || event.code_1c || "");
}
function requireSku(d: DatabaseSync, code: string) {
  if (!code || !d.prepare("SELECT 1 FROM sku WHERE code_1c=?").get(code)) throw new Error(`sku_not_found:${code}`);
}
function month(at: string): string { return at.slice(0, 7); }
function asSignedQty(value: unknown): string {
  const n = new Decimal(String(value));
  if (!n.isFinite()) throw new Error("invalid_quantity");
  return n.toString();
}
function asQty(value: unknown): string {
  const n = new Decimal(String(value));
  if (!n.isFinite() || n.isNegative()) throw new Error("invalid_quantity");
  return n.toString();
}

/** One ledger-backed, idempotent application of an external world event. */
export async function applyWorldEvent(event: WorldEventRow): Promise<ApplyEventResult> {
  const d = db();
  const org_id = event.org_id || (d.prepare("SELECT id FROM organization LIMIT 1").get() as { id?: string } | undefined)?.id || "ORG";
  const source_id = event.source_id || event.id;
  const prior = d.prepare("SELECT id,state FROM world_event WHERE org_id=? AND source_id=?").get(org_id, source_id) as { id: string; state: string } | undefined;
  if (prior?.state === "processed" || prior?.state === "replayed") return { applied: false, affected_codes: [], actions: [], escalations: [], reason: "replayed" };
  const payload = typeof event.payload === "string" ? JSON.parse(event.payload) as P : event.payload;
  const run_id = event.run_id || await startRun({ org_id, trigger_type: "world_event", trigger_ref: event.id });
  const startedRun = !event.run_id;
  const actions: ActionInput[] = [];
  const escalations: ActionInput[] = [];
  const affected = new Set<string>();
  const actionKeys = new Set<string>();
  const add = (kind: string, code: string, summary_ru: string) => {
    affected.add(code);
    const key = `${event.id}:${kind}:${code}`;
    if (!actionKeys.has(key)) actions.push({ kind, code_1c: code, subject_ref: code, summary_ru, world_event_id: event.id, idempotency_key: `event_apply:${key}` });
    actionKeys.add(key);
  };
  try {
    withTx(tx => {
      if (!prior) tx.prepare(`INSERT INTO world_event(id,org_id,kind,code_1c,at,source_id,text,payload,state,run_id,emitted_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(event.id, org_id, event.kind, event.code_1c || null, event.at || new Date().toISOString(), source_id, event.text || null, JSON.stringify(payload), "pending", run_id, new Date().toISOString());
      const eventKind = event.kind === "judge_message"
        ? payload.action === "adjust_in_transit" ? "in_transit_update" : payload.action === "update_unit_cost" ? "price_update" : "judge_message"
        : event.kind;
      const rows = Array.isArray(payload.lines) ? payload.lines as P[]
        : Array.isArray(payload.rows) ? payload.rows as P[]
        : Array.isArray(payload.stocks) ? payload.stocks as P[]
        : payload.line && typeof payload.line === "object" ? [payload.line as P]
        : [payload];
      switch (eventKind) {
        case "sales_day":
        case "judge_message": {
          for (const item of rows) {
            const code = codeFor(item, event) || event.text?.match(/по коду\s+([^\s,.;]+)/i)?.[1] || "";
            requireSku(tx, code);
            let qty = item.qty;
            if (qty == null && event.kind === "judge_message") qty = event.text?.match(/(\d[\d\s]*)\s*шт/)?.[1]?.replace(/\s/g, "");
            const at = String(item.at || event.at || new Date().toISOString());
            const source = event.kind === "judge_message" ? "judge" : "world";
            tx.prepare("INSERT INTO sales_line(code_1c,doc_no,doc_type,at,warehouse,qty,source) VALUES (?,?,?,?,?,?,?)")
              .run(code, String(item.doc_no || event.id), String(item.doc_type || event.kind), at, item.warehouse ? String(item.warehouse) : null, asSignedQty(qty), source);
            if (source === "judge" && (payload.action === "inject_sales_line" || /разов/i.test(event.text || ""))) {
              tx.prepare("INSERT INTO outlier_doc(code_1c,doc_no,at,qty,rule,stat,decision,state) VALUES (?,?,?,?,?,?,?,?)")
                .run(code, String(item.doc_no || event.id), at, asSignedQty(qty), "explicit_judge_oneoff",
                  JSON.stringify({ world_event_id: event.id, source_id }), "owner", "excluded");
            }
            const current = tx.prepare("SELECT qty_lines FROM sales_month WHERE code_1c=? AND ym=?").get(code, month(at)) as { qty_lines: string | null } | undefined;
            const next = new Decimal(current?.qty_lines || 0).plus(asSignedQty(qty)).toString();
            tx.prepare(`INSERT INTO sales_month(code_1c,ym,qty_lines) VALUES (?,?,?)
              ON CONFLICT(code_1c,ym) DO UPDATE SET qty_lines=excluded.qty_lines`).run(code, month(at), next);
            add(event.kind === "judge_message" ? "outlier_flagged" : "recompute", code,
              event.kind === "judge_message" ? "Разовый заказ отмечен для проверки" : "Получен день продаж; требуется пересчёт SKU");
          }
          break;
        }
        case "stock_snapshot": {
          for (const item of rows) {
            const code = codeFor(item, event);
            requireSku(tx, code);
            const ym = String(item.ym || month(String(item.at || event.at || new Date().toISOString())));
            const opening = item.opening_qty ?? item.stock ?? item.qty;
            const known = item.known === 0 || item.known === false ? 0 : opening != null ? 1 : 0;
            tx.prepare(`INSERT INTO stock_month(code_1c,ym,opening_qty,known) VALUES (?,?,?,?)
              ON CONFLICT(code_1c,ym) DO UPDATE SET opening_qty=excluded.opening_qty,known=excluded.known`)
              .run(code, ym, known ? asQty(opening) : null, known);
            add("recompute", code, "Обновлён остаток склада; требуется пересчёт SKU");
          }
          break;
        }
        case "in_transit_update": {
          for (const item of rows) {
            const code = codeFor(item, event);
            requireSku(tx, code);
            const po_ref = String(item.po_ref || item.purchase_order || event.id);
            const old = tx.prepare("SELECT id,qty FROM in_transit WHERE code_1c=? AND po_ref=? ORDER BY id DESC LIMIT 1").get(code, po_ref) as { id: number; qty: string } | undefined;
            const delta = item.delta ?? item.qty_delta ?? item.delta_qty;
            const qty = delta != null ? new Decimal(old?.qty || 0).plus(String(delta)).toString() : asQty(item.qty);
            if (new Decimal(qty).isNegative()) throw new Error("invalid_quantity");
            if (old) tx.prepare("UPDATE in_transit SET qty=?,expected_at=? WHERE id=?").run(qty, item.expected_at ? String(item.expected_at) : null, old.id);
            else tx.prepare("INSERT INTO in_transit(code_1c,po_ref,qty,expected_at,source_file) VALUES (?,?,?,?,?)")
              .run(code, po_ref, qty, item.expected_at ? String(item.expected_at) : null, "world_event");
            add("recompute", code, "Обновлён товар в пути; требуется пересчёт SKU");
          }
          break;
        }
        case "price_update": {
          for (const item of rows) {
            const code = codeFor(item, event);
            requireSku(tx, code);
            const cost = new Decimal(String(item.unit_cost ?? item.price ?? item.to));
            if (!cost.isFinite() || cost.isNegative()) throw new Error("invalid_unit_cost");
            tx.prepare("UPDATE sku SET unit_cost=?,version=version+1 WHERE code_1c=?").run(Money.of(cost.toDecimalPlaces(2)).amount, code);
            add("recompute", code, "Изменена себестоимость SKU");
          }
          break;
        }
        case "supplier_reply":
          actions.push({ kind: "status_change", po_id: String(payload.po_id || ""), subject_ref: String(payload.po_id || event.id), summary_ru: "Получен ответ поставщика", world_event_id: event.id, idempotency_key: `${event.id}:supplier_reply` });
          break;
        default:
          throw new Error(`unsupported_world_event:${event.kind}`);
      }
      tx.prepare("UPDATE world_event SET processing_stage='applied',affected_codes=?,run_id=? WHERE id=?")
        .run(JSON.stringify([...affected]), run_id, prior?.id || event.id);
      bumpStateVersion(tx);
    });
    for (const action of actions) await recordAction(run_id, action);
    if (startedRun) {
      withTx(tx => {
        tx.prepare("UPDATE world_event SET state='processed',processed_at=? WHERE id=?").run(new Date().toISOString(), prior?.id || event.id);
        bumpStateVersion(tx);
      });
      await finishRun(run_id, "done");
    }
    return { applied: true, affected_codes: [...affected], actions, escalations };
  } catch (error) {
    if (startedRun) await finishRun(run_id, "failed");
    throw error;
  }
}
