import { runCalculation } from "@/server/calc";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";
export async function POST(): Promise<Response> {
  return handle(async () => ok(await runCalculation({ scope: { supplier: "SE" } })));
}
