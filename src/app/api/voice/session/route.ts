import { NextResponse } from "next/server";
import { reserveLiveCall } from "../../../../server/demo_guard";

export const runtime = "nodejs";
export const REALTIME_MODEL = "gpt-realtime-2.1";
const endpoint = "https://api.openai.com/v1/realtime/client_secrets";

export const voiceTools = [
  { type: "function", name: "what_needs_me", description: "Read the current approval queue. Never claim approval or sending.", parameters: { type: "object", properties: {}, additionalProperties: false } },
  { type: "function", name: "what_changed", description: "Read persisted agent actions since an optional state version.", parameters: { type: "object", properties: { since: { type: "integer" } }, additionalProperties: false } },
  { type: "function", name: "recommend_for", description: "Run a supplier or category replenishment calculation and prepare proposals for human review. Never approve or send.", parameters: { type: "object", properties: { supplier_id: { type: "string" }, category: { type: "string" } }, additionalProperties: false } },
  { type: "function", name: "explain_sku", description: "Read the actual forecast, outliers, stockouts and rationale for one 1C SKU code.", parameters: { type: "object", properties: { code_1c: { type: "string" } }, required: ["code_1c"], additionalProperties: false } },
] as const;

const instructions = `Ты голосовой помощник Ainalym. Говори по-русски; исходные названия и коды товаров могут быть китайскими. Для фактов о запасах, рекомендациях, очереди и изменениях всегда вызови соответствующий инструмент. Не утверждай, что расчёт, сохранение, одобрение или отправка состоялись, пока инструмент этого не подтвердил. Рекомендация и проект заказа — черновики для проверки человеком; ничего не отправляй поставщику. Если запрос неоднозначен, попроси уточнить. После результата инструмента отвечай только по его JSON; при ошибке честно назови ошибку.`;

export async function POST() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ ok: false, code: "provider_unavailable", label: "Provider unavailable", message: "Voice provider is not configured" }, { status: 503 });
  try {
    if (!reserveLiveCall().allowed) throw new Error("live call budget exhausted");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ session: {
        type: "realtime", model: REALTIME_MODEL, instructions,
        output_modalities: ["audio"], audio: { output: { voice: "marin" }, input: { transcription: { model: "gpt-4o-mini-transcribe" } } },
        tools: voiceTools, tool_choice: "required",
      } }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("session mint failed");
    const data: unknown = await response.json();
    const value = typeof data === "object" && data !== null && "value" in data ? data.value : undefined;
    const expiry = typeof data === "object" && data !== null && "expires_at" in data ? data.expires_at : undefined;
    const now = Math.floor(Date.now() / 1000);
    if (typeof value !== "string" || !value || typeof expiry !== "number" || expiry <= now) throw new Error("invalid session response");
    return NextResponse.json({ ok: true, client_secret: value, expires_at: Math.min(expiry, now + 60), model: REALTIME_MODEL, tools: voiceTools }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, code: "provider_unavailable", label: "Provider unavailable", message: "Voice provider could not start" }, { status: 503 });
  }
}
