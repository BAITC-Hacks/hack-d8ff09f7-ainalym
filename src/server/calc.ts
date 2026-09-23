import { db } from "@/db/client";
import { runCalculation as runDomainCalculation } from "@/domain/apply";
import { orgId } from "./context";
import type { CalcRunRequest } from "./contracts";
import { DataUnavailableError } from "./http";

/** The partner catalog is a union of exports; only rows with sales and known stock can be forecast. */
export async function runCalculation(request: CalcRunRequest) {
  const database = db();
  const required = ["organization", "supplier", "sku", "sales_line", "sales_month", "stock_month"];
  const missing = required.filter(table => {
    const condition = table === "organization" ? ` WHERE id = ?` : "";
    const args = table === "organization" ? [orgId()] : [];
    return !database.prepare(`SELECT 1 FROM ${table}${condition} LIMIT 1`).get(...args);
  });
  if (missing.length) throw new DataUnavailableError(missing);
  const clauses: string[] = [];
  const args: string[] = [];
  if (request.scope.supplier) { clauses.push("s.supplier_id = ?"); args.push(request.scope.supplier); }
  if (request.scope.category) { clauses.push("s.category = ?"); args.push(request.scope.category); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = database.prepare(`SELECT s.code_1c,
    (EXISTS (SELECT 1 FROM sales_line l WHERE l.code_1c=s.code_1c AND l.doc_type='Расходная накладная' AND CAST(l.qty AS REAL)>0)
      OR EXISTS (SELECT 1 FROM sales_month m WHERE m.code_1c=s.code_1c AND CAST(m.qty_file AS REAL)>0)) AS has_sales,
    EXISTS (SELECT 1 FROM stock_month st WHERE st.code_1c=s.code_1c AND st.known=1) AS has_stock
    FROM sku s ${where} ORDER BY s.code_1c`).all(...args) as { code_1c: string; has_sales: number; has_stock: number }[];
  const codes = rows.filter(row => row.has_sales && row.has_stock).map(row => row.code_1c);
  const missing_sales = rows.filter(row => !row.has_sales).length;
  const missing_stock = rows.filter(row => row.has_sales && !row.has_stock).length;
  const result = await runDomainCalculation({ ...request.scope, codes, full_catalog: !request.scope.supplier && !request.scope.category }, request.params || {}, { org_id: orgId() });
  const proposals = result.proposals.map(proposal => ({ id: proposal.id, kind: proposal.kind, subject_id: proposal.subject_id,
    state: proposal.state, money_at_stake: proposal.money_at_stake ? JSON.parse(String(proposal.money_at_stake)) : null }));
  return { run_id: result.run_id, skus: result.skus, recommended: result.recommended, proposals, excluded: { missing_sales, missing_stock } };
}
