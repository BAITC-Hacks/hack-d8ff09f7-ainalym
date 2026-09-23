import { parseContext } from "../../../../components/assistant/context";
import { answerInContext, CANNOT_ANSWER } from "../../../../server/assistant_answers";
import { orgId } from "../../../../server/context";

export const runtime = "nodejs";

/** Context-aware assistant. Always answers in plain Russian; never surfaces technical detail to the user. */
export async function POST(request: Request): Promise<Response> {
  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ ok: false, reply_ru: CANNOT_ANSWER }); }
  if (!input || typeof input !== "object") return Response.json({ ok: false, reply_ru: CANNOT_ANSWER });
  const body = input as { text?: unknown; context?: unknown; base?: unknown };
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 2000) : "";
  const context = parseContext(body.context && typeof body.context === "object" ? JSON.stringify(body.context) : null) ?? { route: "other" as const, entity: {} };
  if (!text) return Response.json({ ok: false, reply_ru: CANNOT_ANSWER });
  try {
    const answer = await answerInContext({ text, context, base: typeof body.base === "string" ? body.base : "", org_id: orgId() });
    return Response.json(answer);
  } catch {
    return Response.json({ ok: false, reply_ru: CANNOT_ANSWER });
  }
}
