import { stateVersion } from "@/db/client";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";
export async function GET(): Promise<Response> {
  return handle(() => { const n = stateVersion(); return ok({ fingerprint: `sv-${n}`, at: new Date().toISOString() }); });
}
