import type { ToolName, ToolScope, ToolResult } from "./tools";
import { mentionedSupplier } from "./transport";
import { openAIModel, type TaskClass } from "../ai/provider";

export const intentTaskClass: TaskClass = "fast";

export interface Intent { tool: ToolName | "clarify"; args: Record<string, unknown> }

export function keywordIntent(text: string, scope: ToolScope): Intent {
  const lower = text.toLowerCase();
  const supplier = mentionedSupplier(text) ?? scope.supplier_id;
  const category = lower.match(/(?:категори[яиюе]|category)\s*[№#:]?\s*([\dа-яa-z_-]+)/i)?.[1];
  const code = scope.code_1c ?? text.match(/(?:код(?:а|у)?(?:\s*1[сc])?|sku)\s*[:№#]?\s*([\p{L}\p{N}_-]{3,})/iu)?.[1] ?? text.match(/\b\d{5,}[_\w-]*\b/)?.[0];
  if (/(?:почему|объясни|обоснован|по коду|прогноз.*товар|sku)/i.test(lower) && code) return { tool: "explain_sku", args: { code_1c: code } };
  if (/(?:что измен|что нового|изменения|что сделал|последние действия)/i.test(lower)) return { tool: "what_changed", args: {} };
  if (/(?:что.*(?:нужно|требует).*меня|очеред|согласован|утверд|мои задачи|решения)/i.test(lower)) return { tool: "what_needs_me", args: {} };
  if (/(?:заказ|рекоменд|пополн|расч[её]т|закуп|заказать)/i.test(lower) && (supplier || category)) {
    return { tool: "recommend_for", args: { ...(supplier ? { supplier_id: supplier } : {}), ...(category ? { category } : {}), utterance: text } };
  }
  return { tool: "clarify", args: {} };
}

export function replyFromResult(tool: ToolName, result: ToolResult): string {
  if (!result.ok) {
    if (result.code === "needs_clarification") return "Уточните количество, затем повторите запрос.";
    if (result.code === "dependency_unavailable") return "Данные пока недоступны. Попробуйте ещё раз позже.";
    return typeof result.message === "string" ? result.message : "Не удалось проверить данные.";
  }
  if (tool === "what_changed") return typeof result.summary_ru === "string" ? result.summary_ru : "Нет подтверждённых изменений.";
  if (tool === "what_needs_me") {
    const items = Array.isArray(result.items) ? result.items : [];
    if (!items.length) return "В очереди сейчас нет решений для вас.";
    return `Нужна ваша проверка: ${items.map(item => typeof item === "object" && item && "title" in item ? String(item.title) : "задача").join("; ")}.`;
  }
  if (tool === "explain_sku") return typeof result.rationale_ru === "string" && result.rationale_ru ? result.rationale_ru : "Обоснование для этого товара ещё не сохранено.";
  if (result.recommended === 0) return `Расчёт ${String(result.run_id)} сохранён. Позиции для заказа не рекомендованы.`;
  return `Расчёт ${String(result.run_id)} сохранён. Рекомендации ждут проверки. Черновик заказа — не отправлен.`;
}

const routingSchema = {
  type: "object", additionalProperties: false,
  properties: {
    tool: { type: "string", enum: ["what_changed", "what_needs_me", "recommend_for", "explain_sku", "clarify"] },
    supplier_id: { type: ["string", "null"] }, category: { type: ["string", "null"] }, code_1c: { type: ["string", "null"] },
  },
  required: ["tool", "supplier_id", "category", "code_1c"],
};

export async function structuredIntent(text: string, scope: ToolScope, key: string): Promise<Intent> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: openAIModel(intentTaskClass),
      instructions: "Classify the Russian purchasing manager request into exactly one Ainalym tool. Chinese product text is source data. Never interpret approval, sending, payment, or quantity adjustment as completed. If the request is ambiguous or unsupported, choose clarify. Use only fields present in the request or scope.",
      input: JSON.stringify({ text, scope }),
      text: { format: { type: "json_schema", name: "ainalym_voice_intent", strict: true, schema: routingSchema } },
    }), cache: "no-store",
  });
  if (!response.ok) throw new Error("provider unavailable");
  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null || !("output" in payload) || !Array.isArray(payload.output)) throw new Error("invalid intent response");
  const message = payload.output.find((item: unknown) => typeof item === "object" && item !== null && "type" in item && item.type === "message");
  const content = message && "content" in message && Array.isArray(message.content) ? message.content : [];
  const part = content.find((item: unknown) => typeof item === "object" && item !== null && "type" in item && item.type === "output_text");
  if (!part || typeof part.text !== "string") throw new Error("missing intent output");
  const parsed: unknown = JSON.parse(part.text);
  if (typeof parsed !== "object" || parsed === null || !("tool" in parsed) || typeof parsed.tool !== "string") throw new Error("invalid intent");
  if (!["what_changed", "what_needs_me", "recommend_for", "explain_sku", "clarify"].includes(parsed.tool)) throw new Error("invalid intent tool");
  const fields = parsed as { tool: Intent["tool"]; supplier_id?: string | null; category?: string | null; code_1c?: string | null };
  const args: Record<string, unknown> = {};
  if (fields.supplier_id) args.supplier_id = fields.supplier_id;
  if (fields.category) args.category = fields.category;
  if (fields.code_1c) args.code_1c = fields.code_1c;
  if (fields.tool === "recommend_for") args.utterance = text;
  return { tool: fields.tool, args };
}
