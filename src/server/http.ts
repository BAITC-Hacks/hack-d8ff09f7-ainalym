import { ZodError, type ZodType } from "zod";
import { stateVersion } from "@/db/client";

export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly field?: string) { super(message); }
}

export async function body<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let value: unknown;
  try { value = await request.json(); }
  catch { throw new HttpError(400, "invalid_json", "Invalid JSON body"); }
  return schema.parse(value);
}

export function ok(data: object = {}, status = 200): Response {
  return Response.json({ ok: true, ...data, state_version: stateVersion() }, { status });
}

export function failure(error: unknown): Response {
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
