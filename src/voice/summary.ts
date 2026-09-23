import type { ToolName, ToolResult, VoiceRender } from "./tools";

export const SPOKEN_SUMMARY_INSTRUCTIONS = "Скажи коротко и структурно: 1) итог одной фразой (сколько и что), 2) три самых важных позиции с количеством и единицей, 3) один следующий шаг. Не читай весь список. Никаких вводных фраз.";

type SpokenItem = { name: string; qty: number | null; unit: string | null; urgency: string | null };

function topItems(render: VoiceRender): SpokenItem[] {
  if (render.kind === "calc_result") return render.items.slice(0, 3).map(item => ({ name: item.name, qty: item.qty, unit: item.unit, urgency: item.urgency }));
  if (render.kind === "sku_explain") return [{ name: render.name, qty: render.qty, unit: render.unit, urgency: render.urgency }];
  if (render.kind === "queue") return render.items.slice(0, 3).map(item => ({
    name: String(item.title ?? item.after ?? "Позиция"), qty: null, unit: null, urgency: null,
  }));
  return render.items.slice(0, 3).map(item => ({
    name: String(item.name ?? item.title ?? "Позиция"),
    qty: typeof item.qty === "number" ? item.qty : null,
    unit: typeof item.unit === "string" ? item.unit : null,
    urgency: typeof item.urgency === "string" ? item.urgency : null,
  }));
}

/** Whitelist only spoken facts. The full result, including render, remains in the client event. */
export function compactVoiceToolResult(name: ToolName | string, result: ToolResult): Record<string, unknown> {
  if (!result.ok) return { ok: false, total: { count: 0, unit: "позиций" }, top_items: [], next_step: String(result.message ?? "Повторите запрос") };
  const render = result.render;
  if (!render) return { ok: false, total: { count: 0, unit: "позиций" }, top_items: [], next_step: "Откройте карточку результата" };
  const count = render.kind === "calc_result" ? render.total : render.kind === "sku_explain" ? 1 : render.items.length;
  const unit = name === "what_changed" ? "действий" : name === "explain_sku" ? "товар" : name === "what_needs_me" ? "решений" : "позиций";
  const next_step = render.kind === "calc_result" ? "Проверьте черновики в очереди решений" :
    render.kind === "sku_explain" ? "Откройте карточку товара для подробностей" :
    name === "what_needs_me" ? (count ? "Откройте очередь решений" : "Новых решений не требуется") :
    name === "what_changed" ? "Откройте журнал действий для подробностей" : "Откройте карточку результата";
  const reason = render.kind === "sku_explain" && render.rationale_ru ? render.rationale_ru.slice(0, 180) : undefined;
  return { ok: true, total: { count, unit }, top_items: topItems(render), ...(reason ? { reason } : {}), next_step };
}

export function spokenFollowUpResponse() {
  // Realtime's audio output includes a text transcript; the API does not accept both output modalities together.
  return { output_modalities: ["audio"], tool_choice: "none", instructions: SPOKEN_SUMMARY_INSTRUCTIONS };
}
