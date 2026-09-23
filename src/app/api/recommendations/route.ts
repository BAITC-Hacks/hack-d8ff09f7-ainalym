import { skuImageUrl } from "@/server/sku_images";
import Decimal from "decimal.js";
import { db } from "@/db/client";
import { RecommendationsQuerySchema } from "@/server/contracts";
import { handle, ok } from "@/server/http";
import { loadMap, loadSkuImages, loadSnapshot } from "@/peers/ekt";

export const runtime = "nodejs";
export async function GET(request: Request): Promise<Response> {
  return handle(() => {
    const query = RecommendationsQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const ektMap = loadMap(), snapshot = loadSnapshot(), images = loadSkuImages();
    const runId = query.run_id || (db().prepare("SELECT id FROM calc_run ORDER BY started_at DESC LIMIT 1").get() as { id: string } | undefined)?.id;
    if (!runId) return ok({ groups: [] });
    const clauses = ["r.run_id = ?", "COALESCE(r.qty_adjusted, r.qty_recommended) > 0"];
    const args: string[] = [runId];
    for (const [param, column] of [["supplier", "r.supplier_id"], ["category", "s.category"], ["urgency", "r.urgency"]]) {
      const value = query[param as keyof typeof query];
      if (value) { clauses.push(`${column} = ?`); args.push(value); }
    }
    const rows = db().prepare(`SELECT r.*, s.name, s.unit, s.moq, s.unit_cost, s.category, f.base_rate
      FROM recommendation r JOIN sku s ON s.code_1c = r.code_1c
      LEFT JOIN forecast f ON f.id = r.forecast_id WHERE ${clauses.join(" AND ")}
      ORDER BY r.supplier_id, r.urgency, r.code_1c`).all(...args);
    const codes = rows.map(row => String(row.code_1c));
    const placeholders = codes.map(() => "?").join(",");
    const outlierRows = codes.length ? db().prepare(`SELECT code_1c,doc_no,qty,rule FROM outlier_doc
      WHERE state='excluded' AND code_1c IN (${placeholders}) ORDER BY code_1c,rowid`).all(...codes) : [];
    const stockoutRows = codes.length ? db().prepare(`SELECT code_1c,ym FROM sales_month
      WHERE stockout=1 AND code_1c IN (${placeholders}) ORDER BY code_1c,ym`).all(...codes) : [];
    const outliersByCode = new Map<string, { doc_no: unknown; qty: unknown; rule: unknown }[]>();
    for (const row of outlierRows) {
      const code = String(row.code_1c);
      outliersByCode.set(code, [...(outliersByCode.get(code) ?? []), { doc_no: row.doc_no, qty: row.qty, rule: row.rule }]);
    }
    const stockoutsByCode = new Map<string, string[]>();
    for (const row of stockoutRows) {
      const code = String(row.code_1c);
      stockoutsByCode.set(code, [...(stockoutsByCode.get(code) ?? []), String(row.ym)]);
    }
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
      const outliers = outliersByCode.get(String(row.code_1c)) ?? [];
      const stockouts = stockoutsByCode.get(String(row.code_1c)) ?? [];
      const product = snapshot.products[ektMap[String(row.code_1c)]?.id];
      group.rows.push({ id: row.id, code_1c: row.code_1c, name: row.name, image_url: skuImageUrl(row) ?? product?.image_url ?? null,
        version: row.version, state: row.state, proposal_id: row.proposal_id, adjust_reason: row.adjust_reason,
        on_hand: row.on_hand, in_transit: row.in_transit,
        forecast_qty: components.forecast_qty == null ? row.base_rate : String(components.forecast_qty), qty_recommended: row.qty_recommended,
        qty_adjusted: row.qty_adjusted, moq: row.moq, unit: row.unit, urgency: row.urgency, rationale_ru: row.rationale_ru, components,
        outliers_excluded: outliers, stockout_months: stockouts,
        ekt_url: product?.product_url ?? null, ekt_price: product?.price ?? null, ekt_currency: product?.currency ?? null,
        ekt_stock_total: product?.stock_total ?? null, ekt_source: product?.source ?? null, ekt_as_of: product?.as_of ?? null });
    }
    return ok({ groups: [...groups.values()] });
  });
}
