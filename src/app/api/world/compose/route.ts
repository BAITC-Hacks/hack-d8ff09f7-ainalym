import { composeEvent, type ComposeInput } from "@/world/compose";
import { WorldError } from "@/world/feed";
import { worldBody, worldResponseError } from "@/world/http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await worldBody(request);
    if (body.kind === "supplier_reply") throw new WorldError("supplier_channel_required", 403);
    return Response.json({ ok: true, ...await composeEvent(body as unknown as ComposeInput) });
  } catch (error) { return worldResponseError(error); }
}
