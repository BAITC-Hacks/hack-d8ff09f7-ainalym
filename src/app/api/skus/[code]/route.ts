import { skuView } from "@/domain/skus";
import { stateVersion } from "@/db/client";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = await skuView(code);
  if (!data) return Response.json({ ok: false, code: "not_found", message: "SKU not found" }, { status: 404 });
  return Response.json({ ok: true, ...data, state_version: stateVersion() });
}
