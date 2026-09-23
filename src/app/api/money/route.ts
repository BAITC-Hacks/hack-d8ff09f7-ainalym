import { moneyView } from "@/domain/cashflow";
import { orgId } from "@/server/context";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";
export async function GET(): Promise<Response> { return handle(async () => ok(await moneyView(orgId()))); }
