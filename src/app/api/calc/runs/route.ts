import { db } from "@/db/client";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";
export async function GET(): Promise<Response> {
  return handle(() => {
    const rows = db().prepare("SELECT * FROM calc_run ORDER BY started_at DESC LIMIT 100").all();
    return ok({ runs: rows.map(row => ({ ...row, scope: JSON.parse(String(row.scope)), params: JSON.parse(String(row.params)) })) });
  });
}
