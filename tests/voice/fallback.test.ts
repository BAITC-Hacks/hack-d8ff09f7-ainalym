import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetInstance } from "../../src/db/client";
import { POST as message } from "../../src/app/api/assistant/message/route";
import { POST as transcribe } from "../../src/app/api/voice/transcribe/route";

const priorPath = process.env.DATABASE_PATH;
const priorKey = process.env.OPENAI_API_KEY;
beforeEach(() => {
  resetInstance();
  process.env.DATABASE_PATH = ":memory:";
  delete process.env.OPENAI_API_KEY;
  db().prepare("INSERT INTO organization (id, name) VALUES (?, ?)").run("ORG-1", "Test");
});
afterEach(() => {
  resetInstance();
  vi.unstubAllGlobals();
  if (priorPath === undefined) delete process.env.DATABASE_PATH; else process.env.DATABASE_PATH = priorPath;
  if (priorKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = priorKey;
});

describe("typed recovery and voice notes", () => {
  it("answers from confirmed ledger data without a provider", async () => {
    db().prepare("INSERT INTO agent_action (id, run_id, org_id, kind, summary_ru, at) VALUES (?, ?, ?, ?, ?, ?)")
      .run("AR-1", "RUN-1", "ORG-1", "recompute", "Рекомендации обновлены", "2026-09-23T00:00:00Z");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const response = await message(new Request("http://localhost/api/assistant/message", {
      method: "POST", body: JSON.stringify({ text: "Что изменилось?", scope: { org_id: "ORG-1" }, request_id: "typed-recovery" }),
    }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.reply_ru).toBe("Рекомендации обновлены");
    expect(body.labels.intent).toBe("Rules, no LLM");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not invent a transcript when the provider is missing", async () => {
    const response = await transcribe(new Request("http://localhost/api/voice/transcribe", { method: "POST" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "provider_unavailable", label: "Provider unavailable" });
  });

  it("stores only a provider-returned voice note and replays it", async () => {
    process.env.OPENAI_API_KEY = "unit-test-only";
    const fetcher = vi.fn().mockResolvedValue(Response.json({ text: "Проверь заказ SE" }));
    vi.stubGlobal("fetch", fetcher);
    const payload = () => {
      const form = new FormData();
      form.set("org_id", "ORG-1");
      form.set("request_id", "note-1");
      form.set("file", new File(["mock audio"], "note.webm", { type: "audio/webm" }));
      return new Request("http://localhost/api/voice/transcribe", { method: "POST", body: form });
    };
    const first = await transcribe(payload());
    const second = await transcribe(payload());
    expect(first.status).toBe(200);
    expect(await second.json()).toMatchObject({ replayed: true, note: { medium: "voice_note", label: "Голосовая заметка · транскрипция", transcript: "Проверь заказ SE" } });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(db().prepare("SELECT transcript FROM voice_note WHERE request_id = ?").get("note-1")).toMatchObject({ transcript: "Проверь заказ SE" });
  });
});
