import { db, stateVersion } from "@/db/client";
import { EXPORT_LABEL } from "@/peers/onec_export";
import { activeOrg } from "@/world/feed";
import { worldResponseError } from "@/world/http";

export const runtime = "nodejs";
export async function GET() {
  try {
    activeOrg();
    const rows = db().prepare("SELECT id,external_identity,kind,payload,version,state,as_of FROM ledger_peer_record WHERE peer = 'onec_export' ORDER BY as_of DESC").all() as Record<string, unknown>[];
    return Response.json({ ok: true, rows: rows.map((row) => ({ ...row, payload: JSON.parse(String(row.payload)), label: EXPORT_LABEL, external: "export_only" })), state_version: stateVersion() });
  } catch (error) { return worldResponseError(error); }
}
