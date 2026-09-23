import Decimal from "decimal.js";
import { db, bumpStateVersion, withTx } from "../db/client";
import { syncOrderObligations } from "./obligations";
import { formatAmount, Money } from "./money";

type Order = Record<string, unknown>;

export function orderById(id: string): (Order & { lines: Order[] }) | null {
  const d = db();
  const order = d.prepare("SELECT * FROM purchase_order WHERE id=?").get(id) as Order | undefined;
  if (!order) return null;
  const lines = d.prepare("SELECT l.*,s.article,s.name,s.moq FROM purchase_order_line l LEFT JOIN sku s ON s.code_1c=l.code_1c WHERE po_id=? ORDER BY l.id").all(id) as Order[];
  const priced = lines.filter(line => line.unit_cost !== null);
  const totalCost = priced.length ? formatAmount(priced.reduce(
    (sum, line) => sum.plus(new Decimal(String(line.qty)).times(String(line.unit_cost))), new Decimal(0))) : null;
  return { ...order, total_cost: totalCost, cost_known_lines: priced.length,
    unknown_cost_lines: lines.length - priced.length, lines };
}

export function listOrders(): (Order & { lines: Order[] })[] {
  const ids = db().prepare("SELECT id FROM purchase_order ORDER BY supplier_id,id").all() as { id: string }[];
  return ids.map(r => orderById(r.id)!).filter(Boolean);
}

/** Human approval binds the exact visible version and creates the supplier commitment. */
export function approveOrder(id: string, version: number): Order {
  return withTx(d => {
    const po = d.prepare("SELECT * FROM purchase_order WHERE id=?").get(id) as Order | undefined;
    if (!po) throw new Error("order_not_found");
    if (po.version !== version) throw new Error("stale_order_version");
    if (po.state !== "draft") throw new Error("order_not_draft");
    const lines = d.prepare("SELECT qty,unit_cost FROM purchase_order_line WHERE po_id=?").all(id) as Order[];
    if (!lines.length) throw new Error("order_has_no_lines");
    const known = lines.filter(l => l.unit_cost !== null);
    const total = known.length === lines.length
      ? Money.of(lines.reduce((a, l) => a.plus(new Decimal(String(l.unit_cost)).times(String(l.qty))), new Decimal(0)).toDecimalPlaces(2)).amount
      : null;
    d.prepare("UPDATE purchase_order SET state='approved',total_qty=?,total_cost=?,cost_known_lines=?,version=version+1 WHERE id=? AND version=?")
      .run(lines.reduce((n, l) => n + parseInt(String(l.qty), 10), 0), total, known.length, id, version);
    syncOrderObligations(id, d);
    bumpStateVersion(d);
    return d.prepare("SELECT * FROM purchase_order WHERE id=?").get(id) as Order;
  });
}

export function markOrderExported(id: string, path: string): Order {
  if (!path.trim()) throw new Error("export_path_required");
  return withTx(d => {
    const po = d.prepare("SELECT * FROM purchase_order WHERE id=?").get(id) as Order | undefined;
    if (!po) throw new Error("order_not_found");
    if (po.state !== "approved") throw new Error("order_not_approved");
    d.prepare("UPDATE purchase_order SET state='exported',export_path=?,version=version+1 WHERE id=?").run(path, id);
    bumpStateVersion(d);
    return d.prepare("SELECT * FROM purchase_order WHERE id=?").get(id) as Order;
  });
}
