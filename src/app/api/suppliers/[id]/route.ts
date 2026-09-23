import { db, withTx, bumpStateVersion, stateVersion } from "@/db/client";
export const runtime = "nodejs";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ ok: false, code: "invalid", message: "Некорректный запрос" }, { status: 400 }); }
  if (!body || Object.keys(body).length !== 1 || !["domestic", "eaeu", "import"].includes(String(body.route)))
    return Response.json({ ok: false, code: "invalid_route", message: "Укажите маршрут: domestic, eaeu или import" }, { status: 400 });
  const id = (await params).id;
  const found = withTx(tx => { const result = tx.prepare("UPDATE supplier SET route=?,version=version+1 WHERE id=?").run(body.route as string,id); if (result.changes) bumpStateVersion(tx); return result.changes > 0; });
  return found ? Response.json({ ok: true, supplier: db().prepare("SELECT id,name,route,version FROM supplier WHERE id=?").get(id), state_version: stateVersion() }) :
    Response.json({ ok: false, code: "not_found", message: "Поставщик не найден" }, { status: 404 });
}
