import { ektStatus } from "@/peers/ekt";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";
export async function GET(): Promise<Response> { return handle(async () => ok(await ektStatus())); }
