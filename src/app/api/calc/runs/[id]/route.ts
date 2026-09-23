import { db } from "@/db/client";
import { handle, HttpError, ok } from "@/server/http";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    const row = db().prepare("SELECT * FROM calc_run WHERE id = ?").get(id);
    if (!row) throw new HttpError(404, "not_found", "Run not found");
    return ok({ run: { ...row, scope: JSON.parse(String(row.scope)), params: JSON.parse(String(row.params)) } });
  });
}
