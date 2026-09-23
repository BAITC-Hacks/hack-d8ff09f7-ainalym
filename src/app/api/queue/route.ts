import { queueView } from "@/domain/views";
import { db } from "@/db/client";
import { orgId } from "@/server/context";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";
export async function GET(): Promise<Response> {
  return handle(async () => {
    const view = await queueView(orgId());
    if (view.items.length) return ok(view);
    const proposals = db().prepare(`SELECT id,kind,subject_id,rationale_ru,sources,money_at_stake,created_at
      FROM proposal WHERE state='needs_review' ORDER BY money_at_stake IS NULL, created_at DESC LIMIT 100`).all();
    const items = proposals.map(row => ({ id: row.id, kind: "proposal", title: row.kind === "supplier_order" ? `Заказ поставщику ${row.subject_id}` : `Проверить ${row.kind}`,
      why: row.rationale_ru || "Требуется решение", sources: JSON.parse(String(row.sources)),
      money_at_stake: row.money_at_stake ? JSON.parse(String(row.money_at_stake)) : null,
      options: [{ key: "approve", label: "Утвердить", effect: "Подготовить заказ" }, { key: "reject", label: "Отклонить", effect: "Не создавать заказ" }],
      href: `/proposals/${row.id}`, since: row.created_at }));
    return ok({ items, ...(items.length ? {} : { empty_reason: view.empty_reason || "Нет решений" }) });
  });
}
