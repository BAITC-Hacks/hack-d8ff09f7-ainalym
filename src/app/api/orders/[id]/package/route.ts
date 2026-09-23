import { packageForOrder } from "@/server/documents";
import { stateVersion } from "@/db/client";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = packageForOrder((await params).id);
  return result ? Response.json({ ok: true, ...result, state_version: stateVersion() }) :
    Response.json({ ok: false, code: "not_found", message: "Заказ не найден" }, { status: 404 });
}
