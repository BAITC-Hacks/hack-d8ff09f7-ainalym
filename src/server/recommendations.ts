import { db } from "@/db/client";
import { HttpError } from "@/server/http";

/** The same recommendation detail is returned by GET and a successful adjustment. */
export function recommendationById(id: string) {
  const database = db();
  const row = database.prepare(`SELECT r.*, s.name, s.moq, s.unit_cost, s.category, f.base_rate
    FROM recommendation r LEFT JOIN sku s ON s.code_1c=r.code_1c
    LEFT JOIN forecast f ON f.id=r.forecast_id WHERE r.id=?`).get(id) as Record<string, unknown> | undefined;
  if (!row) throw new HttpError(404, "not_found", "Recommendation not found");
  const components = JSON.parse(String(row.components || "{}"));
  const outliers = database.prepare("SELECT doc_no, qty, rule FROM outlier_doc WHERE code_1c=? AND state='excluded'").all(row.code_1c as string);
  const stockouts = database.prepare("SELECT ym FROM sales_month WHERE code_1c=? AND stockout=1 ORDER BY ym").all(row.code_1c as string).map(item => String(item.ym));
  return { ...row, components, forecast_qty: components.forecast_qty == null ? row.base_rate : String(components.forecast_qty),
    outliers_excluded: outliers, stockout_months: stockouts };
}
