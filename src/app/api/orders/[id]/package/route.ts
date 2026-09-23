import { packageForOrder } from "@/server/documents";
import { stateVersion } from "@/db/client";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = packageForOrder((await params).id);
    return result ? Response.json({ ok: true, ...result, state_version: stateVersion() }) :
      Response.json({ ok: false, code: "not_found", message: "Заказ не найден" }, { status: 404 });
  } catch (error) {
    if (error instanceof Error && error.message === "supplier_route_required")
      return Response.json({ ok: false, code: "supplier_route_required", message: "Уточните маршрут поставки у менеджера" }, { status: 422 });
    throw error;
  }
}
