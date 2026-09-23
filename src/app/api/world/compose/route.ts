import { composeEvent, type ComposeInput } from "@/world/compose";
import { worldBody, worldResponseError } from "@/world/http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await worldBody(request);
    return Response.json({ ok: true, ...await composeEvent(body as unknown as ComposeInput) });
  } catch (error) { return worldResponseError(error); }
}
