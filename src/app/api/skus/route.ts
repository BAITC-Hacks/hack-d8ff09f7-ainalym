import { db } from "@/db/client";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";
export async function GET(request: Request): Promise<Response> {
  return handle(() => {
    const query = new URL(request.url).searchParams;
    const clauses: string[] = [];
    const args: string[] = [];
    if (query.get("q")) { clauses.push("(code_1c LIKE ? OR name LIKE ? OR article LIKE ?)"); args.push(...Array(3).fill(`%${query.get("q")}%`)); }
    if (query.get("supplier")) { clauses.push("supplier_id = ?"); args.push(query.get("supplier")!); }
    if (query.get("category")) { clauses.push("category = ?"); args.push(query.get("category")!); }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = Math.min(500, Math.max(1, Number(query.get("limit") || 100) || 100));
    const offset = Math.max(0, Number(query.get("offset") || 0) || 0);
    const total = (db().prepare(`SELECT COUNT(*) AS n FROM sku ${where}`).get(...args) as { n: number }).n;
    const items = db().prepare(`SELECT * FROM sku ${where} ORDER BY supplier_id, code_1c LIMIT ? OFFSET ?`).all(...args, limit, offset);
    return ok({ items, total });
  });
}
