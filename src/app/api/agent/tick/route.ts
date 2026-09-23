import { tick } from "@/ai/worker";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";
export async function POST(): Promise<Response> { return handle(async () => ok(await tick())); }
