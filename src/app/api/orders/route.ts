import { listOrders } from "@/domain/orders";
import { stateVersion } from "@/db/client";

export async function GET() {
  return Response.json({ ok: true, orders: listOrders(), state_version: stateVersion() });
}
