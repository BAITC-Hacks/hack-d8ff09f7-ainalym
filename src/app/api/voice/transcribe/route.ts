import { randomUUID } from "node:crypto";
import { bumpStateVersion, db, stateVersion, withTx } from "../../../../db/client";

export const runtime = "nodejs";
const label = "Голосовая заметка · транскрипция";
const unavailable = () => Response.json({ ok: false, code: "provider_unavailable", label: "Provider unavailable", message: "Transcription provider is unavailable" }, { status: 503 });

export async function POST(request: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return unavailable();
  let body: FormData;
  try { body = await request.formData(); } catch { return Response.json({ ok: false, code: "invalid", message: "Multipart audio required" }, { status: 400 }); }
  const file = body.get("file");
  const orgId = body.get("org_id");
  const requestId = body.get("request_id");
  if (!(file instanceof File) || file.size === 0 || file.size > 20_000_000 || typeof orgId !== "string" || !orgId || typeof requestId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(requestId)) {
    return Response.json({ ok: false, code: "invalid", message: "Valid file, org_id and request_id required" }, { status: 400 });
  }
  if (!db().prepare("SELECT 1 FROM organization WHERE id = ?").get(orgId)) return Response.json({ ok: false, code: "denied", message: "Unknown organization scope" }, { status: 403 });
  db().exec(`CREATE TABLE IF NOT EXISTS voice_note (
    id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, org_id TEXT NOT NULL, medium TEXT NOT NULL,
    label TEXT NOT NULL, transcript TEXT, state TEXT NOT NULL, created_at TEXT NOT NULL
  )`);
  const previous = db().prepare("SELECT id, org_id, transcript, state FROM voice_note WHERE request_id = ?").get(requestId) as { id: string; org_id: string; transcript: string | null; state: string } | undefined;
  if (previous) {
    if (previous.org_id !== orgId) return Response.json({ ok: false, code: "request_conflict", message: "request_id belongs to another scope" }, { status: 409 });
    if (previous.state === "done" && previous.transcript) return Response.json({ ok: true, note: { id: previous.id, medium: "voice_note", label, transcript: previous.transcript }, replayed: true, state_version: stateVersion() });
    return Response.json({ ok: false, code: "request_pending", message: "Transcription is in progress" }, { status: 409 });
  }
  const id = `VN-${randomUUID()}`;
  const inserted = db().prepare("INSERT OR IGNORE INTO voice_note (id, request_id, org_id, medium, label, state, created_at) VALUES (?, ?, ?, 'voice_note', ?, 'pending', ?)").run(id, requestId, orgId, label, new Date().toISOString());
  if (!inserted.changes) return Response.json({ ok: false, code: "request_pending", message: "Transcription is in progress" }, { status: 409 });
  try {
    const payload = new FormData();
    payload.set("model", "gpt-4o-mini-transcribe");
    payload.set("file", file);
    payload.set("prompt", "Русская речь о закупке электротоваров. Названия товаров и коды 1С могут быть на китайском.");
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: `Bearer ${key}` }, body: payload, cache: "no-store",
    });
    if (!response.ok) throw new Error("transcription failed");
    const result: unknown = await response.json();
    const transcript = typeof result === "object" && result !== null && "text" in result && typeof result.text === "string" ? result.text.trim() : "";
    if (!transcript) throw new Error("empty transcription");
    const version = withTx(d => {
      d.prepare("UPDATE voice_note SET transcript = ?, state = 'done' WHERE id = ?").run(transcript, id);
      return bumpStateVersion(d);
    });
    return Response.json({ ok: true, note: { id, medium: "voice_note", label, transcript }, state_version: version, labels: { ai: "Live AI" } });
  } catch {
    db().prepare("DELETE FROM voice_note WHERE id = ? AND state = 'pending'").run(id);
    return unavailable();
  }
}
