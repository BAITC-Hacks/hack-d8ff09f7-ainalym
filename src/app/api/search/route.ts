import { repo } from "@/db/repo";
import { stateVersion } from "@/db/client";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length > 120) return Response.json({ ok: false, code: "invalid_query", message: "Поисковый запрос не должен быть длиннее 120 символов." }, { status: 400 });
  const q = query.toLocaleLowerCase("ru-RU");
  const matches = (...values: (string | null)[]) => values.some(value => value?.toLocaleLowerCase("ru-RU").includes(q));
  try {
    if (!query) return Response.json({ ok: true, query, items: [], state_version: stateVersion() }, { headers: { "Cache-Control": "no-store" } });
    const skus = repo("sku").list({}, 10000).filter(row => matches(row.code_1c, row.name, row.article, row.supplier_id)).slice(0, 12).map(row => ({ id: row.code_1c, kind: "sku", title: row.name, meta: `${row.code_1c} · ${row.supplier_id}`, href: `/skus/${encodeURIComponent(row.code_1c)}` }));
    const orders = repo("purchase_order").list({}, 10000).filter(row => matches(row.id, row.supplier_id)).slice(0, 6).map(row => ({ id: row.id, kind: "order", title: `Заказ ${row.id}`, meta: row.supplier_id, href: `/orders/${encodeURIComponent(row.id)}` }));
    const runs = repo("calc_run").list({}, 10000).filter(row => matches(row.id, row.scope)).slice(-6).reverse().map(row => ({ id: row.id, kind: "run", title: `Расчёт ${row.id}`, meta: row.started_at, href: `/replenishment?run_id=${encodeURIComponent(row.id)}` }));
    return Response.json({ ok: true, query, items: [...skus, ...orders, ...runs], state_version: stateVersion() }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ ok: false, code: "search_unavailable", message: "Поиск временно недоступен. Попробуйте ещё раз." }, { status: 503 }); }
}
