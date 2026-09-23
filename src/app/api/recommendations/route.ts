import Decimal from "decimal.js";
import { db } from "@/db/client";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";
export async function GET(request: Request): Promise<Response> {
  return handle(() => {
    const query = new URL(request.url).searchParams;
    const runId = query.get("run_id") || (db().prepare("SELECT id FROM calc_run ORDER BY started_at DESC LIMIT 1").get() as { id: string } | undefined)?.id;
    if (!runId) return ok({ groups: [] });
    const clauses = ["r.run_id = ?"];
    const args: string[] = [runId];
    for (const [param, column] of [["supplier", "r.supplier_id"], ["category", "s.category"], ["urgency", "r.urgency"]]) {
      const value = query.get(param);
      if (value) { clauses.push(`${column} = ?`); args.push(value); }
    }
    const rows = db().prepare(`SELECT r.*, s.name, s.moq, s.unit_cost, s.category, f.base_rate
      FROM recommendation r JOIN sku s ON s.code_1c = r.code_1c
      LEFT JOIN forecast f ON f.id = r.forecast_id WHERE ${clauses.join(" AND ")}
      ORDER BY r.supplier_id, r.urgency, r.code_1c`).all(...args);
    const groups = new Map<string, { supplier_id: string; total_qty: number; total_cost: { amount: string; currency: string } | null; cost_known_lines: number; rows: unknown[] }>();
    for (const row of rows) {
      const supplier = String(row.supplier_id);
      let group = groups.get(supplier);
      if (!group) { group = { supplier_id: supplier, total_qty: 0, total_cost: null, cost_known_lines: 0, rows: [] }; groups.set(supplier, group); }
      const qty = Number(row.qty_adjusted ?? row.qty_recommended);
      group.total_qty += qty;
      if (row.unit_cost !== null) {
        group.cost_known_lines++;
        group.total_cost = { amount: new Decimal(group.total_cost?.amount || "0").plus(new Decimal(String(row.unit_cost)).mul(qty)).toFixed(2), currency: "KZT" };
      }
      const components = JSON.parse(String(row.components || "{}"));
      const outliers = db().prepare("SELECT doc_no, qty, rule FROM outlier_doc WHERE code_1c = ? AND state = 'excluded'").all(row.code_1c);
      const stockouts = db().prepare("SELECT ym FROM sales_month WHERE code_1c = ? AND stockout = 1 ORDER BY ym").all(row.code_1c).map(r => String(r.ym));
      group.rows.push({ id: row.id, code_1c: row.code_1c, name: row.name, on_hand: row.on_hand, in_transit: row.in_transit,
        forecast_qty: components.forecast_qty == null ? row.base_rate : String(components.forecast_qty), qty_recommended: row.qty_recommended,
        qty_adjusted: row.qty_adjusted, moq: row.moq, urgency: row.urgency, rationale_ru: row.rationale_ru, components,
        outliers_excluded: outliers, stockout_months: stockouts });
    }
    return ok({ groups: [...groups.values()] });
  });
}
