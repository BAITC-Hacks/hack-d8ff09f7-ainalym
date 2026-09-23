import { recommendationById } from "@/server/recommendations";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => ok({ recommendation: recommendationById((await params).id) }));
}
