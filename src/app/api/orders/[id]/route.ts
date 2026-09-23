import { orderById } from "@/domain/orders";
import { stateVersion } from "@/db/client";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = orderById(id);
  if (!order) return Response.json({ ok: false, code: "not_found", message: "Order not found" }, { status: 404 });
  return Response.json({ ok: true, order, state_version: stateVersion() });
}
