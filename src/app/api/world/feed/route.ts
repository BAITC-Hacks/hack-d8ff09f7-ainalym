import { feed, type WorldState } from "@/world/feed";
import { worldResponseError } from "@/world/http";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    return Response.json({ ok: true, ...feed({ state: query.get("state") as WorldState | undefined ?? undefined, code: query.get("code") ?? undefined, org_id: query.get("org_id") ?? undefined }) });
  } catch (error) { return worldResponseError(error); }
}
