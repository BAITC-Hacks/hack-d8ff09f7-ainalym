import { db } from "@/db/client";
import { agentStats } from "@/server/ledger";
import { orgId } from "@/server/context";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";
export async function GET(request: Request): Promise<Response> {
  return handle(() => {
    const query = new URL(request.url).searchParams;
    const clauses = ["org_id = ?"];
    const values: (string | number)[] = [orgId()];
    if (query.get("since")) { clauses.push("at >= ?"); values.push(query.get("since")!); }
    if (query.get("code")) { clauses.push("code_1c = ?"); values.push(query.get("code")!); }
    if (query.get("po")) { clauses.push("po_id = ?"); values.push(query.get("po")!); }
    const limit = Math.min(200, Math.max(1, Number(query.get("limit") || 50) || 50));
    const rows = db().prepare(`SELECT * FROM agent_action WHERE ${clauses.join(" AND ")} ORDER BY at DESC, rowid DESC LIMIT ?`).all(...values, limit);
    const stats = agentStats(orgId());
    return ok({ rows: rows.map(row => ({ ...row, sources: JSON.parse(String(row.sources)) })), stats: { auto: stats.auto, needs_you: stats.needs_you } });
  });
}
