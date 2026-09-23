import Decimal from "decimal.js";
import { db, bumpStateVersion, withTx } from "../db/client";
import type { DatabaseSync } from "node:sqlite";
import { Money } from "./money";

type Row = Record<string, unknown>;
const money = (n: Decimal.Value) => Money.of(new Decimal(n).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)).amount;

/** Derive the two contractual payments from an approved PO's priced lines. */
export function syncOrderObligations(poId: string, tx?: DatabaseSync): Row[] {
  const run = (d: DatabaseSync): Row[] => {
    const po = d.prepare("SELECT p.*, s.terms, s.currency FROM purchase_order p JOIN supplier s ON s.id=p.supplier_id WHERE p.id=?").get(poId) as Row | undefined;
    if (!po) throw new Error("order_not_found");
    if (po.state !== "approved" && po.state !== "exported") throw new Error("order_not_approved");
    const lines = d.prepare("SELECT qty,unit_cost FROM purchase_order_line WHERE po_id=?").all(poId) as Row[];
    if (!lines.length) throw new Error("order_has_no_lines");
    const priced = lines.filter(l => l.unit_cost !== null);
    if (!priced.length) return [];
    const total = priced.reduce((a, l) => a.plus(new Decimal(String(l.unit_cost)).times(String(l.qty))), new Decimal(0));
    const terms = JSON.parse(String(po.terms || "{}")) as Record<string, unknown>;
    const pct = new Decimal(String(terms.prepayment_pct ?? terms.prepay_pct ?? terms.prepayment_percent ?? 30));
    if (pct.lt(0) || pct.gt(100)) throw new Error("invalid_supplier_terms");
    const prepayment = new Decimal(money(total.times(pct).div(100)));
    const installments = [
      { kind: "supplier_prepayment", amount: prepayment, due_at: new Date().toISOString() },
      { kind: "supplier_balance", amount: total.minus(prepayment), due_at: String(po.eta || new Date().toISOString()) },
    ];
    for (const item of installments) {
      const id = `${poId}:${item.kind}`;
      const existing = d.prepare("SELECT state,amount,due_at FROM obligation WHERE id=?").get(id) as Row | undefined;
      if (existing?.state === "settled") continue;
      if (item.kind === "supplier_prepayment" && existing?.due_at) item.due_at = String(existing.due_at);
      if (existing?.amount === money(item.amount) && existing?.due_at === item.due_at) continue;
      d.prepare(`INSERT INTO obligation(id,kind,po_id,supplier_id,amount,currency,due_at,state,basis)
        VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET amount=excluded.amount,due_at=excluded.due_at,
        state='open',version=obligation.version+1`).run(id, item.kind, poId, String(po.supplier_id), money(item.amount), String(po.currency), item.due_at, "open", poId);
      bumpStateVersion(d);
    }
    return d.prepare("SELECT * FROM obligation WHERE po_id=? ORDER BY kind").all(poId) as Row[];
  };
  return tx ? run(tx) : withTx(run);
}

export function openObligations(): Row[] {
  return db().prepare("SELECT * FROM obligation WHERE state='open' ORDER BY due_at,id").all() as Row[];
}
