import { db } from "@/db/client";
import { orgId } from "@/server/context";
import { handle, HttpError, ok } from "@/server/http";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    const run = db().prepare("SELECT * FROM agent_run WHERE id = ? AND org_id = ?").get(id, orgId());
    if (!run) throw new HttpError(404, "not_found", "Agent run not found");
    const actions = db().prepare("SELECT * FROM agent_action WHERE run_id = ? ORDER BY at").all(id);
    return ok({ run, actions: actions.map(row => ({ ...row, sources: JSON.parse(String(row.sources)) })) });
  });
}
