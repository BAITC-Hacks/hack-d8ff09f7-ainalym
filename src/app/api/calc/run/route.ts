import { CalcRunRequestSchema } from "@/server/contracts";
import { runCalculation } from "@/server/calc";
import { body, handle, ok } from "@/server/http";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  return handle(async () => ok(await runCalculation(await body(request, CalcRunRequestSchema))));
}
