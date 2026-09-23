import { playDemo } from "@/world/demo";
import { worldBody, worldResponseError } from "@/world/http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await worldBody(request);
    return Response.json({ ok: true, ...await playDemo({ steps: body.steps as number | undefined, org_id: body.org_id as string | undefined }) });
  } catch (error) { return worldResponseError(error); }
}
