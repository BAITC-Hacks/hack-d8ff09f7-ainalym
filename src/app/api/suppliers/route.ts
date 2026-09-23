import { suppliersOverview } from "@/server/suppliers_overview";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";

/** Read-only per-supplier overview for the «Поставщики» screen. */
export async function GET(): Promise<Response> {
  return handle(async () => ok(await suppliersOverview()));
}
