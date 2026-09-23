import { db } from "../db/client";

type Row = Record<string, unknown>;

export function listSkus(filters: { q?: string; supplier?: string; category?: string; limit?: number } = {}): Row[] {
  const clauses: string[] = [];
  const args: (string | number)[] = [];
  if (filters.q) { clauses.push("(s.code_1c LIKE ? OR s.name LIKE ? OR s.article LIKE ?)"); args.push(...Array(3).fill(`%${filters.q}%`)); }
  if (filters.supplier) { clauses.push("s.supplier_id=?"); args.push(filters.supplier); }
  if (filters.category) { clauses.push("s.category=?"); args.push(filters.category); }
  const limit = Math.min(500, Math.max(1, filters.limit ?? 100));
  return db().prepare(`SELECT s.*,sup.name AS supplier_name FROM sku s JOIN supplier sup ON sup.id=s.supplier_id
    ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY s.supplier_id,s.code_1c LIMIT ?`).all(...args, limit) as Row[];
}

export async function skuView(code_1c: string): Promise<Record<string, unknown> | null> {
  const d = db();
  const sku = d.prepare("SELECT s.*,sup.name AS supplier_name,sup.currency FROM sku s JOIN supplier sup ON sup.id=s.supplier_id WHERE s.code_1c=?").get(code_1c) as Row | undefined;
  if (!sku) return null;
  const sales = d.prepare("SELECT * FROM sales_month WHERE code_1c=? ORDER BY ym").all(code_1c) as Row[];
  const stock = d.prepare("SELECT * FROM stock_month WHERE code_1c=? ORDER BY ym").all(code_1c) as Row[];
  const outliers = d.prepare("SELECT id,doc_no,at,qty,rule,decision,state FROM outlier_doc WHERE code_1c=? ORDER BY at,id").all(code_1c) as Row[];
  const months = new Map<string, Row>();
  for (const row of sales) months.set(String(row.ym), { ym: row.ym, qty_file: row.qty_file, qty_lines: row.qty_lines, qty_regular: row.qty_regular, stockout: row.stockout });
  for (const row of stock) months.set(String(row.ym), { ...months.get(String(row.ym)), ym: row.ym, stock: row.known ? row.opening_qty : null, stock_known: Boolean(row.known) });
  for (const row of outliers) {
    const ym = String(row.at || "").slice(0, 7);
    const item = months.get(ym) || { ym };
    item.outliers = [...(item.outliers as Row[] || []), row];
    months.set(ym, item);
  }
  const forecast = d.prepare("SELECT * FROM forecast WHERE code_1c=? ORDER BY rowid DESC LIMIT 1").get(code_1c) as Row | undefined;
  const recommendation = d.prepare("SELECT * FROM recommendation WHERE code_1c=? ORDER BY rowid DESC LIMIT 1").get(code_1c) as Row | undefined;
  const in_transit = d.prepare("SELECT * FROM in_transit WHERE code_1c=? ORDER BY expected_at,id").all(code_1c) as Row[];
  const timeline = d.prepare("SELECT id,kind,summary_ru,rationale_ru,autonomy,result,at,run_id FROM agent_action WHERE code_1c=? ORDER BY at DESC LIMIT 50").all(code_1c) as Row[];
  return { sku, series: [...months.values()].sort((a, b) => String(a.ym).localeCompare(String(b.ym))), forecast: forecast || null, recommendation: recommendation || null, in_transit, timeline };
}
