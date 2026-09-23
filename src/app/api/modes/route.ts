import { handle, ok, truthAxes } from "@/server/http";
import { db } from "@/db/client";

export const runtime = "nodejs";
export async function GET(): Promise<Response> {
  return handle(() => {
    const org = db().prepare("SELECT payload FROM organization WHERE id = 'partner'").get() as { payload: string } | undefined;
    const fetchedAt = org ? (JSON.parse(org.payload) as { etl_fetched_at?: string }).etl_fetched_at ?? null : null;
    return ok({
    axes: truthAxes(),
    connections: [
      { id: "onec_in", label: "Вход: стандартные отчёты 1С УТ", detail: "динамика продаж, остатки, товар в пути, MOQ загружаются как есть, без доработки конфигурации", state: fetchedAt ? "active" : "unavailable", external: "file_import", as_of: fetchedAt },
      { id: "onec_out", label: "Экспорт для 1С (файл)", state: "active", external: "export_only" },
    ],
    sources: fetchedAt ? [{ name: "Вход: стандартные отчёты 1С УТ", as_of: fetchedAt, anonymised: true }] : [],
    onec: { label: "Экспорт для 1С (файл)", external: "export_only" },
    labels: {
      provenance: "Данные партнёра · обезличены", agents: "Агенты · данные партнёра", ai_live: "Живой AI",
      ai_rules: "Правила без LLM", ai_replay: "Воспроизведение · записанное решение", ai_unavailable: "Провайдер недоступен",
      external: "Экспорт для 1С (файл)", supplier_draft: "Черновик заказа — не отправлен",
      world: "Симулятор мира — синтетическое событие", voice_live: "Голос: живой", voice_unavailable: "Голос недоступен",
      urgency: { critical: "критично", soon: "скоро", normal: "планово", none: "не требуется" },
      task: { preparing: "Готовлю", awaiting_supplier: "Ждём поставщика", needs_review: "Нужна ваша проверка", ready_to_handover: "Готово к передаче", handed_over: "Передано", handover_failed: "Ошибка передачи" },
      proposal: { draft: "черновик", needs_review: "ждёт вас", approved: "утверждено", stale: "устарело — есть новая версия", rejected: "отклонено", delivered: "передано", delivery_failed: "ошибка передачи" },
    },
    });
  });
}
