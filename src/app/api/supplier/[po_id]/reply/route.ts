import { supplierReply } from "@/peers/supplier";
import { worldBody, worldResponseError } from "@/world/http";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ po_id: string }> }) {
  try {
    const { po_id } = await params;
    const body = await worldBody(request);
    return Response.json({ ok: true, ...await supplierReply(po_id, body as { action: "send_demo" | "confirm"; text?: string }) });
  } catch (error) { return worldResponseError(error); }
}
