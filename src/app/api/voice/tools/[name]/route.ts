import { executeVoiceTool } from "../../../../../voice/tools";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ name: string }> }) {
  let raw: unknown;
  try { raw = await request.json(); }
  catch { return Response.json({ ok: false, code: "invalid", message: "Invalid JSON" }, { status: 400 }); }
  const { name } = await params;
  const { status, result } = await executeVoiceTool(name, raw, request.url);
  return Response.json(result, { status, headers: { "Cache-Control": "no-store" } });
}
