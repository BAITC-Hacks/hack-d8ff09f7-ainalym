import { documentById } from "@/server/documents";
import { stateVersion } from "@/db/client";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const document = documentById((await params).id);
  return document ? Response.json({ ok: true, document, state_version: stateVersion() }) :
    Response.json({ ok: false, code: "not_found", message: "Документ не найден" }, { status: 404 });
}
