import { db, withTx, bumpStateVersion, stateVersion } from "@/db/client";
import { documentById } from "@/server/documents";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let version: number;
  try { version = (await request.json()).version; }
  catch { return Response.json({ ok: false, code: "invalid", message: "Укажите версию документа" }, { status: 400 }); }
  if (!Number.isSafeInteger(version) || version < 1) return Response.json({ ok: false, code: "invalid", message: "Укажите версию документа" }, { status: 400 });
  const id = (await params).id;
  const result = withTx(tx => {
    const prior = tx.prepare("SELECT version,state FROM document WHERE id=?").get(id) as { version: number; state: string } | undefined;
    if (!prior) return "not_found";
    if (prior.version !== version) return "stale_version";
    if (prior.state === "accepted") return "already_accepted";
    tx.prepare("UPDATE document SET state='accepted',version=version+1 WHERE id=? AND version=?").run(id, version);
    bumpStateVersion(tx);
    return "accepted";
  });
  if (result !== "accepted") return Response.json({ ok: false, code: result, current_version: (db().prepare("SELECT version FROM document WHERE id=?").get(id) as { version?: number } | undefined)?.version ?? null },
    { status: result === "not_found" ? 404 : 409 });
  return Response.json({ ok: true, document: documentById(id), state_version: stateVersion() });
}
