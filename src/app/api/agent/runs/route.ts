import { db } from "@/db/client";
import { orgId } from "@/server/context";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";
export async function GET(): Promise<Response> {
  return handle(() => ok({ runs: db().prepare("SELECT * FROM agent_run WHERE org_id = ? ORDER BY started_at DESC LIMIT 100").all(orgId()) }));
}
