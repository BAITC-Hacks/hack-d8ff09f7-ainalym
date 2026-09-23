import { stateVersion } from "../../../../db/client";
import { executeVoiceTool } from "../../../../voice/tools";
import type { ToolScope } from "../../../../voice/tools";
import { keywordIntent, replyFromResult, structuredIntent } from "../../../../voice/typed";

export const runtime = "nodejs";
export async function POST(request: Request) {
  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ ok: false, code: "invalid", message: "Invalid JSON" }, { status: 400 }); }
  if (typeof input !== "object" || input === null || !("text" in input) || typeof input.text !== "string" || !input.text.trim() || !("scope" in input) || typeof input.scope !== "object" || input.scope === null || !("org_id" in input.scope) || typeof input.scope.org_id !== "string" || !("request_id" in input) || typeof input.request_id !== "string") {
    return Response.json({ ok: false, code: "invalid", message: "text, scope and request_id are required" }, { status: 400 });
  }
  const { text, scope, request_id } = input as { text: string; scope: ToolScope; request_id: string };
  const key = process.env.OPENAI_API_KEY;
  let intent = keywordIntent(text, scope);
  let intentMode = "Rules, no LLM";
  if (key) {
    try { intent = await structuredIntent(text, scope, key); intentMode = "Live AI"; }
    catch { intentMode = "Provider unavailable"; }
  }
  if (intent.tool === "recommend_for" && "state_version" in input && Number.isInteger(input.state_version)) intent.args.expected_state_version = input.state_version;
  if (intent.tool === "clarify") {
    return Response.json({ ok: true, reply_ru: "Уточните, пожалуйста: изменения, очередь решений, расчёт по поставщику или объяснение товара?", labels: { ai: intentMode }, state_version: stateVersion() });
  }
  const { status, result } = await executeVoiceTool(intent.tool, { request_id, scope, args: intent.args });
  return Response.json({ ok: result.ok, reply_ru: replyFromResult(intent.tool, result), tool: intent.tool, result, labels: { ...result.labels, intent: intentMode }, state_version: result.state_version }, { status });
}
