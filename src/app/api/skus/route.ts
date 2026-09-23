import { db } from "@/db/client";
import { SkuQuerySchema } from "@/server/contracts";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";
export async function GET(request: Request): Promise<Response> {
  return handle(() => {
    const query = SkuQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const clauses: string[] = [];
    const args: string[] = [];
    if (query.q) { clauses.push("(code_1c LIKE ? OR name LIKE ? OR article LIKE ?)"); args.push(...Array(3).fill(`%${query.q}%`)); }
    if (query.supplier) { clauses.push("supplier_id = ?"); args.push(query.supplier); }
    if (query.category) { clauses.push("category = ?"); args.push(query.category); }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    const total = (db().prepare(`SELECT COUNT(*) AS n FROM sku ${where}`).get(...args) as { n: number }).n;
    const items = db().prepare(`SELECT * FROM sku ${where} ORDER BY supplier_id, code_1c LIMIT ? OFFSET ?`).all(...args, limit, offset);
    return ok({ items, total });
  });
}
