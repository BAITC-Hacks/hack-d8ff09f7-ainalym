import { db, stateVersion } from "@/db/client";
import { moneyView } from "@/domain/cashflow";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orgId = url.searchParams.get("org_id") || (db().prepare("SELECT id FROM organization LIMIT 1").get() as { id?: string } | undefined)?.id;
  if (!orgId) return Response.json({ ok: false, code: "not_found", message: "Organization not found" }, { status: 404 });
  try {
    return Response.json({ ok: true, ...(await moneyView(orgId)), state_version: stateVersion() });
  } catch {
    return Response.json({ ok: false, code: "not_found", message: "Organization not found" }, { status: 404 });
  }
}
