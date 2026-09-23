import { repo } from "@/db/repo";
import { stateVersion } from "@/db/client";

export const runtime = "nodejs";
export async function GET() {
  try {
    const proposals = repo("proposal").list({ state: "needs_review" }, 10000).map(row => ({ id: row.id, kind: "review", title: row.kind === "supplier_order" ? "Заказ ждёт вашей проверки" : row.kind === "param_change" ? "Изменение параметров ждёт проверки" : "Аномалия ждёт проверки", detail: row.rationale_ru ?? row.id, href: `/review/${encodeURIComponent(row.id)}`, at: row.created_at }));
    const failed = repo("world_event").list({ state: "failed" }, 10000).map(row => ({ id: row.id, kind: "failure", title: "Событие не обработано", detail: row.text ?? row.id, href: row.run_id ? `/world/runs/${encodeURIComponent(row.run_id)}` : "/world", at: row.processed_at ?? row.at ?? "" }));
    const items = [...proposals, ...failed].sort((a,b) => b.at.localeCompare(a.at));
    return Response.json({ ok: true, items: items.slice(0, 50), total: items.length, state_version: stateVersion() }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ ok: false, code: "notifications_unavailable", message: "Не удалось загрузить уведомления." }, { status: 503 }); }
}
