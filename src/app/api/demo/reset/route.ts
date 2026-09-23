import { resetDemo } from "@/server/fixtures";
import { handle, HttpError, ok } from "@/server/http";

export const runtime = "nodejs";
export async function POST(): Promise<Response> {
  return handle(() => {
    try { return ok(resetDemo()); }
    catch (error) { throw new HttpError(503, "etl_unavailable", error instanceof Error ? error.message : "ETL unavailable"); }
  });
}
