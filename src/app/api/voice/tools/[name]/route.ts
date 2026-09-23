import { executeVoiceTool } from "../../../../../voice/tools";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  let raw: unknown;
  try { raw = await request.json(); } catch { raw = null; }
  const { status, result } = await executeVoiceTool(name, raw);
  return Response.json(result, { status, headers: { "Cache-Control": "no-store" } });
}
