import { ZodError, type ZodType } from "zod";
import { stateVersion } from "@/db/client";

export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly field?: string) { super(message); }
}

export class DataUnavailableError extends Error {
  constructor(readonly missing: string[]) { super("Required calculation data is unavailable"); }
}

export function truthAxes(): { provenance: "partner_anonymised"; ai: "live" | "rules" | "replay" | "unavailable"; external: "export_only" } {
  const provider = process.env.AI_PROVIDER || (process.env.TYPESAFE_API_KEY || process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY ? "jev" : "rules");
  const configured = provider === "jev" ? !!(process.env.TYPESAFE_API_KEY || process.env.AI_GATEWAY_API_KEY) : provider === "openai" ? !!process.env.OPENAI_API_KEY : false;
  return { provenance: "partner_anonymised", ai: provider === "rules" ? "rules" : provider === "offline" ? "replay" : configured ? "live" : "unavailable", external: "export_only" };
}

export async function body<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let value: unknown;
  try { value = await request.json(); }
  catch { throw new HttpError(400, "invalid_json", "Invalid JSON body"); }
  return schema.parse(value);
}

export function ok(data: object = {}, status = 200): Response {
  return Response.json({ ok: true, ...truthAxes(), ...data, state_version: stateVersion() }, { status });
}

export function failure(error: unknown): Response {
  if (error instanceof DataUnavailableError) return Response.json({ error: "data_unavailable", missing: error.missing }, { status: 503 });
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    return Response.json({ ok: false, code: "invalid_request", message: issue?.message || "Invalid request", field: issue?.path.join(".") }, { status: 400 });
  }
  if (error instanceof HttpError) return Response.json({ ok: false, code: error.code, message: error.message, ...(error.field ? { field: error.field } : {}) }, { status: error.status });
  return Response.json({ ok: false, code: "internal_error", message: "Internal error" }, { status: 500 });
}

export async function handle(fn: () => Promise<Response> | Response): Promise<Response> {
  try { return await fn(); } catch (error) { return failure(error); }
}
