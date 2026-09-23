import { moneyView } from "@/domain/cashflow";
import { orgId } from "@/server/context";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const selectedOrg = new URL(request.url).searchParams.get("org_id") || orgId();
    return ok(await moneyView(selectedOrg));
  });
}
