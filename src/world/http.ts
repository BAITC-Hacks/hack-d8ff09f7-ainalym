import { WorldError } from "./feed";

export function worldResponseError(error: unknown): Response {
  if (error instanceof WorldError) return Response.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
  return Response.json({ ok: false, code: "world_error", message: "World event operation failed" }, { status: 500 });
}

export async function worldBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try { body = await request.json(); } catch { throw new WorldError("invalid_json", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new WorldError("invalid_body", 400);
  return body as Record<string, unknown>;
}
