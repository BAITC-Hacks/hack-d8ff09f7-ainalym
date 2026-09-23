import { handle, ok, truthAxes } from "@/server/http";

export const runtime = "nodejs";
export async function GET(): Promise<Response> {
  return handle(() => ok({
    axes: truthAxes(),
    labels: {
      provenance: "Данные партнёра · обезличены", agents: "Агенты · данные партнёра", ai_live: "Живой AI",
      ai_rules: "Правила без LLM", ai_replay: "Воспроизведение · записанное решение", ai_unavailable: "Провайдер недоступен",
      external: "Экспорт для 1С (файл)", supplier_draft: "Черновик заказа — не отправлен",
      world: "Симулятор мира — синтетическое событие", voice_live: "Голос: живой", voice_unavailable: "Голос недоступен",
      urgency: { critical: "критично", soon: "скоро", normal: "планово", none: "не требуется" },
      task: { preparing: "Готовлю", awaiting_supplier: "Ждём поставщика", needs_review: "Нужна ваша проверка", ready_to_handover: "Готово к передаче", handed_over: "Передано", handover_failed: "Ошибка передачи" },
      proposal: { draft: "черновик", needs_review: "ждёт вас", approved: "утверждено", stale: "устарело — есть новая версия", rejected: "отклонено", delivered: "передано", delivery_failed: "ошибка передачи" },
    },
  }));
}
