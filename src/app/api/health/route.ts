import { db, stateVersion } from "@/db/client";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const providers = {
    jev: process.env.TYPESAFE_API_KEY || process.env.AI_GATEWAY_API_KEY ? "configured" : "missing",
    openai: process.env.OPENAI_API_KEY ? "configured" : "missing",
    voice: process.env.OPENAI_API_KEY ? "configured" : "missing",
  } as const;
  const mode = process.env.AINALYM_MODE || (providers.jev === "configured" || providers.openai === "configured" ? "live" : "offline");
  const ai_provider = process.env.AI_PROVIDER || (providers.jev === "configured" ? "jev" : providers.openai === "configured" ? "openai" : "rules");
  try {
    db().prepare("SELECT 1").get();
    return Response.json({ ok: true, mode, ai_provider, providers, db: "ok", version: stateVersion() });
  } catch {
    return Response.json({ ok: false, code: "database_unavailable", message: "Database unavailable" }, { status: 503 });
  }
}
