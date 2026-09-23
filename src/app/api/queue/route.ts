import { queueView } from "@/domain/views";
import { orgId } from "@/server/context";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";
export async function GET(): Promise<Response> {
  return handle(async () => {
    const view = await queueView(orgId());
    return ok(view);
  });
}
