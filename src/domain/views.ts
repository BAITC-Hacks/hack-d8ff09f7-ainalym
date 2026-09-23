import Decimal from "decimal.js";
import type { DatabaseSync } from "node:sqlite";
import { db } from "../db/client";
import { moneyView } from "./cashflow";

export { moneyView } from "./cashflow";
export { skuView } from "./skus";

type ProposalRow = { id: string; kind: string; subject_id: string | null; rationale_ru: string | null; sources: string; money_at_stake: string | null; created_at: string; payload: string };
type TaskRow = { id: string; title: string; next_event_at: string | null; proposal_id: string | null; updated_at: string };
export interface QueueItem { id: string; kind: "proposal" | "task"; title: string; why: string; sources: unknown[]; money_at_stake: unknown; options: { key: string; label: string; effect: string }[]; href: string; since: string }

export async function queueView(_orgId: string, database: DatabaseSync = db()): Promise<{ items: QueueItem[]; empty_reason?: string }> {
  const proposals = database.prepare("SELECT id,kind,subject_id,rationale_ru,sources,money_at_stake,created_at,payload FROM proposal WHERE state='needs_review' ORDER BY created_at,id")
    .all() as ProposalRow[];
  const proposalIds = new Set(proposals.map((row) => row.id));
  const tasks = database.prepare("SELECT id,title,next_event_at,proposal_id,updated_at FROM task WHERE state='needs_review' ORDER BY updated_at,id")
    .all() as TaskRow[];
  const items: QueueItem[] = proposals.map((row) => {
    const payload = JSON.parse(row.payload) as { lines?: unknown[] };
    const title = row.kind === "supplier_order" ? `Заказ поставщику ${row.subject_id}: ${payload.lines?.length ?? 0} позиций` :
      row.kind === "clarification" ? `Уточнить ожидание по задаче ${row.subject_id}` : `Проверить ${row.kind}`;
    return { id: row.id, kind: "proposal", title, why: row.rationale_ru ?? "Требуется ваше решение",
      sources: JSON.parse(row.sources), money_at_stake: row.money_at_stake ? JSON.parse(row.money_at_stake) : null,
      options: row.kind === "clarification" ? [
        { key: "approve", label: "Подготовить уточнение", effect: "Создаст одобренное внутреннее действие; отправка отдельно" },
        { key: "reject", label: "Перенести срок", effect: "Закроет предложение без отправки" },
      ] : [
        { key: "approve", label: "Утвердить", effect: "Создаст заказ поставщику и обязательства по известным ценам; не отправит его" },
        { key: "reject", label: "Отклонить", effect: "Закроет предложение без заказа" },
      ], href: `/proposals/${row.id}`, since: row.created_at };
  });
  for (const task of tasks) {
    if (task.proposal_id && proposalIds.has(task.proposal_id)) continue;
    const linked = task.proposal_id ? database.prepare("SELECT state FROM proposal WHERE id=?").get(task.proposal_id) as { state: string } | undefined : undefined;
    if (linked && linked.state !== "needs_review") continue;
    items.push({ id: task.id, kind: "task", title: task.title, why: task.next_event_at ? `Следующее событие: ${task.next_event_at}` : "Требуется проверка задачи",
      sources: [`task:${task.id}`], money_at_stake: null, options: [
        { key: "ready_to_handover", label: "Готово к передаче", effect: "Переведёт задачу в состояние готовности" },
        { key: "preparing", label: "Вернуть в работу", effect: "Вернёт задачу к подготовке" },
      ], href: `/tasks/${task.id}`, since: task.updated_at });
  }
  items.sort((a, b) => {
    const amount = (item: QueueItem) => item.money_at_stake && typeof item.money_at_stake === "object" && "amount" in item.money_at_stake
      ? new Decimal(String(item.money_at_stake.amount)) : new Decimal(0);
    const cost = amount(b).comparedTo(amount(a));
    return cost || a.since.localeCompare(b.since);
  });
  return items.length ? { items } : { items, empty_reason: "Сейчас нет решений, требующих проверки" };
}

export async function todayView(orgId: string, database: DatabaseSync = db()): Promise<Record<string, unknown>> {
  const queue = await queueView(orgId, database);
  const money = await moneyView(orgId);
  const risks = database.prepare(`SELECT r.code_1c,s.name,r.urgency,r.components,sup.lead_time_days
    FROM recommendation r JOIN sku s ON s.code_1c=r.code_1c JOIN supplier sup ON sup.id=s.supplier_id
    WHERE r.id=(SELECT r2.id FROM recommendation r2 JOIN calc_run c2 ON c2.id=r2.run_id WHERE r2.code_1c=r.code_1c ORDER BY c2.finished_at DESC,r2.id DESC LIMIT 1)
    AND r.urgency IN ('critical','soon') ORDER BY CASE r.urgency WHEN 'critical' THEN 0 ELSE 1 END,r.code_1c`) .all() as
    { code_1c: string; name: string; urgency: string; components: string; lead_time_days: number }[];
  const top = risks.slice(0, 5).map((row) => ({ code_1c: row.code_1c, name: row.name,
    days_of_cover: (JSON.parse(row.components) as { days_of_cover?: number }).days_of_cover ?? null,
    lead_time_days: row.lead_time_days, urgency: row.urgency }));
  const stats = database.prepare("SELECT SUM(CASE WHEN autonomy='auto' THEN 1 ELSE 0 END) AS auto,SUM(CASE WHEN autonomy='escalated' THEN 1 ELSE 0 END) AS needs_you FROM agent_action")
    .get() as { auto: number | null; needs_you: number | null };
  const auto = stats.auto ?? 0;
  const needsYou = stats.needs_you ?? 0;
  const orders = database.prepare("SELECT id,supplier_id,state,total_cost,eta FROM purchase_order ORDER BY eta LIMIT 8")
    .all() as { id: string; supplier_id: string; state: string; total_cost: string | null; eta: string | null }[];
  const runs = database.prepare("SELECT id,finished_at,recommended FROM calc_run ORDER BY finished_at DESC LIMIT 5")
    .all() as { id: string; finished_at: string | null; recommended: number }[];
  const background = database.prepare("SELECT id,summary_ru,at FROM agent_action WHERE autonomy='auto' ORDER BY at DESC LIMIT 5").all();
  const feedNext = database.prepare("SELECT id,kind,code_1c,at FROM world_event WHERE state='scripted' ORDER BY seq LIMIT 3").all();
  const decision = queue.items[0] ?? null;
  const lead = decision ? `Нужно решение: ${decision.title}.` : risks.length ? `Под наблюдением ${risks.length} позиций с риском дефицита.` : "Новых решений нет; расчёт пополнения готов к запуску.";
  return { lead, decision, queue_count: queue.items.length,
    pulse: { money, stockout_risk: { count: risks.length, top }, decisions: queue.items.length,
      cash_committed: (money as { committed_by_supplier?: unknown }).committed_by_supplier ?? [],
      agents: { auto, needs_you: needsYou, ratio: auto + needsYou ? auto / (auto + needsYou) : 0 } },
    commitments: [
      ...orders.map((order) => ({ id: order.id, kind: "po", title: `Заказ ${order.supplier_id}`, next_event: order.eta,
        amount: order.total_cost ? { amount: order.total_cost, currency: "KZT" } : null, owner: "Закупки", state: order.state })),
      ...runs.map((run) => ({ id: run.id, kind: "run", title: `Расчёт: ${run.recommended} рекомендаций`, next_event: run.finished_at,
        amount: null, owner: "Агент", state: "done" })),
    ], background, feed_next: feedNext, ...(decision || risks.length || orders.length || runs.length ? {} : { empty_reason: "Нет расчётов и новых событий" }) };
}

export async function ordersView(_orgId: string, database: DatabaseSync = db()): Promise<{ orders: Record<string, unknown>[]; empty_reason?: string }> {
  const orders = database.prepare("SELECT * FROM purchase_order ORDER BY eta DESC,id DESC").all() as Record<string, unknown>[];
  const shaped = orders.map((order) => ({ ...order,
    total_cost: order.total_cost ? { amount: order.total_cost, currency: "KZT" } : null,
    lines: database.prepare("SELECT code_1c,qty,unit_cost,rationale_ru FROM purchase_order_line WHERE po_id=? ORDER BY code_1c").all(order.id as string) }));
  return shaped.length ? { orders: shaped } : { orders: [], empty_reason: "Одобренных заказов пока нет" };
}
