import Decimal from "decimal.js";
import { db } from "../db/client";

type Row = Record<string, unknown>;
type MoneyRow = { amount: string; currency: string };
const amount = (n: Decimal.Value) => new Decimal(n).toDecimalPlaces(2).toFixed(2);

export interface MoneyView {
  cash: MoneyRow[];
  committed_by_supplier: { supplier_id: string; amount: string; currency: string; lines: number; cost_known_lines: number }[];
  next_60d: { out: { at: string; amount: string; currency: string; po_id: string; kind: string }[] };
  stock_value: { amount: string; currency: string; cost_known_share: number; cost_unknown_count: number } | null;
  risks: { code: string; count: number; label_ru: string }[];
}

/** Cash, commitments and stock value are views over persisted rows, never independent balances. */
export async function moneyView(orgId: string, asOf = new Date()): Promise<MoneyView> {
  const d = db();
  const org = d.prepare("SELECT payload FROM organization WHERE id=?").get(orgId) as { payload: string } | undefined;
  if (!org) throw new Error("organization_not_found");
  const opening = (JSON.parse(org.payload).opening_cash || []) as MoneyRow[];
  const cash = new Map<string, Decimal>();
  for (const row of opening) cash.set(row.currency, (cash.get(row.currency) || new Decimal(0)).plus(row.amount));
  const payments = d.prepare("SELECT direction,amount,currency FROM payment").all() as Row[];
  for (const row of payments) {
    const currency = String(row.currency);
    const value = new Decimal(String(row.amount));
    cash.set(currency, (cash.get(currency) || new Decimal(0)).plus(row.direction === "in" ? value : value.negated()));
  }
  const cashRows = [...cash].sort(([a], [b]) => a.localeCompare(b)).map(([currency, value]) => ({ amount: amount(value), currency }));

  const orders = d.prepare(`SELECT p.id,p.supplier_id,p.state,s.currency,l.qty,l.unit_cost
    FROM purchase_order p JOIN supplier s ON s.id=p.supplier_id JOIN purchase_order_line l ON l.po_id=p.id
    WHERE p.state IN ('approved','exported') ORDER BY p.supplier_id,p.id,l.id`).all() as Row[];
  const bySupplier = new Map<string, { supplier_id: string; amount: Decimal; currency: string; lines: number; cost_known_lines: number }>();
  for (const row of orders) {
    const supplier_id = String(row.supplier_id), currency = String(row.currency);
    const key = `${supplier_id}:${currency}`;
    const item = bySupplier.get(key) || { supplier_id, amount: new Decimal(0), currency, lines: 0, cost_known_lines: 0 };
    item.lines++;
    if (row.unit_cost !== null) {
      item.amount = item.amount.plus(new Decimal(String(row.unit_cost)).times(Number(row.qty)));
      item.cost_known_lines++;
    }
    bySupplier.set(key, item);
  }
  const committed_by_supplier = [...bySupplier.values()].map(r => ({ ...r, amount: amount(r.amount) }));
  const horizon = new Date(asOf);
  horizon.setUTCDate(horizon.getUTCDate() + 60);
  const out = (d.prepare("SELECT kind,po_id,amount,currency,due_at FROM obligation WHERE state='open' AND due_at>=? AND due_at<=? ORDER BY due_at,id")
    .all(asOf.toISOString(), horizon.toISOString()) as Row[])
    .map(r => ({ at: String(r.due_at), amount: String(r.amount), currency: String(r.currency), po_id: String(r.po_id), kind: String(r.kind) }));

  const stock = d.prepare(`SELECT s.code_1c,s.unit_cost,sup.currency,sm.opening_qty,sm.known FROM sku s
    JOIN supplier sup ON sup.id=s.supplier_id LEFT JOIN stock_month sm ON sm.code_1c=s.code_1c
    AND sm.ym=(SELECT max(x.ym) FROM stock_month x WHERE x.code_1c=s.code_1c)
    WHERE sm.code_1c IS NOT NULL`).all() as Row[];
  const stockKnown = stock.filter(r => r.unit_cost !== null && r.known === 1 && r.opening_qty !== null);
  const stockUnknown = stock.length - stockKnown.length;
  const byCurrency = new Map<string, Decimal>();
  for (const row of stockKnown) {
    const c = String(row.currency);
    byCurrency.set(c, (byCurrency.get(c) || new Decimal(0)).plus(new Decimal(String(row.unit_cost)).times(String(row.opening_qty))));
  }
  const stock_value = byCurrency.size === 1 ? {
    amount: amount([...byCurrency.values()][0]), currency: [...byCurrency.keys()][0],
    cost_known_share: stock.length ? stockKnown.length / stock.length : 0, cost_unknown_count: stockUnknown,
  } : null;
  const unknownSkuCost = (d.prepare("SELECT count(*) AS n FROM sku WHERE unit_cost IS NULL").get() as { n: number }).n;
  const unknownCount = unknownSkuCost;
  return {
    cash: cashRows, committed_by_supplier, next_60d: { out }, stock_value,
    risks: unknownCount ? [{ code: "cost_unknown", count: unknownCount, label_ru: "Себестоимость не задана" }] : [],
  };
}
