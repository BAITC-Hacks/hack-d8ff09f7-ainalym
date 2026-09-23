import { db, stateVersion } from "@/db/client";
import { decide } from "@/ai/decisions";
import { z } from "zod";

const RequestBody = z.object({ question_id: z.string().min(1), subject_ref: z.string().min(1), context: z.unknown() });

export async function POST(request: Request): Promise<Response> {
  let body: z.infer<typeof RequestBody>;
  try { body = RequestBody.parse(await request.json()); }
  catch { return Response.json({ ok: false, code: "invalid", message: "Invalid decision request" }, { status: 400 }); }
  try {
    const decision = await decide(body.question_id, body.subject_ref, body.context);
    if (decision.result_state === "provider_error") {
      return Response.json({ ok: false, code: "provider_unavailable", message: "Decision provider unavailable", decision }, { status: 503 });
    }
    return Response.json({ ok: true, decision, state_version: stateVersion() });
  } catch {
    return Response.json({ ok: false, code: "decision_failed", message: "Decision could not be recorded" }, { status: 500 });
  }
}

export async function GET(request: Request): Promise<Response> {
  const subject = new URL(request.url).searchParams.get("subject");
  const rows = subject
    ? db().prepare("SELECT * FROM decision_record WHERE subject_ref = ? ORDER BY at DESC LIMIT 100").all(subject)
    : db().prepare("SELECT * FROM decision_record ORDER BY at DESC LIMIT 100").all();
  return Response.json({ ok: true, decisions: rows.map(row => ({
    ...row, distribution: JSON.parse(String(row.distribution)),
    evidence_versions: row.evidence_versions ? JSON.parse(String(row.evidence_versions)) : {},
    label: row.mode === "rules" ? "Правила без LLM" : row.mode === "replay" ? "Replay · recorded decision" : undefined,
  })), state_version: stateVersion() });
}
