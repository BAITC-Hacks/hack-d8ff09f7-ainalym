import Decimal from "decimal.js";
import type { DatabaseSync } from "node:sqlite";
import { db } from "../db/client";
import { moneyView } from "./cashflow";

export { moneyView } from "./cashflow";
export { skuView } from "./skus";

type ProposalRow = { id: string; kind: string; subject_id: string | null; rationale_ru: string | null; money_at_stake: string | null; created_at: string; lines_count: number; state: string; version: number };
type TaskRow = { id: string; title: string; next_event_at: string | null; proposal_id: string | null; updated_at: string };
export interface QueueItem { id: string; kind: "proposal" | "task"; title: string; why: string; sources: unknown[]; money_at_stake: unknown; options: { key: string; label: string; effect: string }[]; href: string; since: string; supplier?: string | null; lines_count?: number; total?: unknown; state?: string; version?: number }

export async function queueView(orgId: string, database: DatabaseSync = db()): Promise<{ items: QueueItem[]; empty_reason?: string }> {
  const proposals = database.prepare(`WITH ranked AS (
    SELECT id,kind,subject_id,rationale_ru,money_at_stake,created_at,state,version,
      CASE WHEN kind='supplier_order' THEN json_array_length(payload,'$.lines') ELSE 0 END AS lines_count,
      ROW_NUMBER() OVER (PARTITION BY CASE WHEN kind='supplier_order' THEN subject_id ELSE id END ORDER BY created_at DESC,rowid DESC) AS rank
    FROM proposal WHERE state='needs_review' AND (org_id=? OR org_id IS NULL))
    SELECT id,kind,subject_id,rationale_ru,money_at_stake,created_at,state,version,lines_count
    FROM ranked WHERE rank=1 ORDER BY created_at DESC LIMIT 100`).all(orgId) as ProposalRow[];
  const proposalIds = new Set(proposals.map((row) => row.id));
  const tasks = database.prepare(`SELECT t.id,t.title,t.next_event_at,t.proposal_id,t.updated_at FROM task t
    LEFT JOIN proposal p ON p.id=t.proposal_id
    WHERE t.state='needs_review' AND (t.proposal_id IS NULL OR p.state='needs_review')
    ORDER BY t.updated_at DESC,t.id DESC LIMIT 100`).all() as TaskRow[];
  const items: QueueItem[] = proposals.map((row) => {
    const title = row.kind === "supplier_split" ? `Разделить поставку по заказу ${row.subject_id}` :
      row.kind === "supplier_expedite" ? `Ускорить поставку по заказу ${row.subject_id}` :
      row.kind === "supplier_order" ? `Заказ поставщику ${row.subject_id}: ${row.lines_count} позиций` :
      row.kind === "clarification" ? `Уточнить ожидание по задаче ${row.subject_id}` : `Проверить ${row.kind}`;
    const total = row.money_at_stake ? JSON.parse(row.money_at_stake) : null;
    return { id: row.id, kind: "proposal", title, why: row.rationale_ru ?? "Требуется ваше решение",
      sources: [`proposal:${row.id}`], money_at_stake: total, supplier: row.subject_id, lines_count: row.lines_count,
      total, state: row.state, version: row.version,
      options: row.kind === "supplier_split" ? [
        { key: "approve", label: "Утвердить разделение", effect: "Разделит заказ и покажет платежи 30 % / 70 % по каждой части; ничего не отправит" },
        { key: "reject", label: "Отклонить", effect: "Оставит заказ без изменений" },
      ] : row.kind === "supplier_expedite" ? [
        { key: "approve", label: "Поручить ускорение", effect: "Поднимет срочность и создаст задачу; ничего не отправит" },
        { key: "reject", label: "Отклонить", effect: "Оставит заказ без изменений" },
      ] : row.kind === "clarification" ? [
        { key: "approve", label: "Подготовить уточнение", effect: "Создаст одобренное внутреннее действие; отправка отдельно" },
        { key: "reject", label: "Перенести срок", effect: "Закроет предложение без отправки" },
      ] : [
        { key: "approve", label: "Подготовить заказ", effect: "Создаст внутренний черновик; отдельное одобрение заказа создаст обязательства" },
        { key: "reject", label: "Отклонить", effect: "Закроет предложение без заказа" },
      ], href: `/review/${row.id}`, since: row.created_at };
  });
  const seenGaps = new Set<string>();
  const visibleTasks = tasks.filter(task => {
    if (!task.title.startsWith("Проверить отсутствующие источники ")) return true;
    const key = task.title.split(":", 1)[0];
    if (seenGaps.has(key)) return false;
    seenGaps.add(key);
    return true;
  });
  const taskIds = visibleTasks.map(task => task.id);
  const actionRows = taskIds.length ? database.prepare(`SELECT subject_ref,rationale_ru FROM agent_action
    WHERE kind='escalation' AND subject_ref IN (${taskIds.map(() => "?").join(",")}) ORDER BY at DESC,rowid DESC`).all(...taskIds) as { subject_ref: string; rationale_ru: string | null }[] : [];
  const actions = new Map<string, string | null>();
  for (const action of actionRows) if (!actions.has(action.subject_ref)) actions.set(action.subject_ref, action.rationale_ru);
  for (const task of visibleTasks) {
    if (task.proposal_id && proposalIds.has(task.proposal_id)) continue;
    items.push({ id: task.id, kind: "task", title: task.title,
      why: actions.get(task.id) ?? (task.next_event_at ? `Следующее событие: ${task.next_event_at}` : task.title),
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
  let money: unknown;
  try { money = await moneyView(orgId); }
  catch (error) {
    if (!(error instanceof Error) || error.message !== "organization_not_found") throw error;
    money = { cash: [], committed_by_supplier: [], next_60d: { out: [] }, stock_value: null, risks: [], empty_reason: "organization_not_found" };
  }
  const risks = database.prepare(`WITH latest AS (
      SELECT r.supplier_id,MAX(r.rowid) AS last_row FROM recommendation r
      JOIN calc_run c ON c.id=r.run_id WHERE c.org_id=? OR c.org_id IS NULL GROUP BY r.supplier_id),
    latest_run AS (SELECT r.supplier_id,r.run_id FROM latest l JOIN recommendation r ON r.rowid=l.last_row)
    SELECT r.code_1c,s.name,r.urgency,r.components,sup.lead_time_days,COUNT(*) OVER () AS risk_count
    FROM latest_run lr JOIN recommendation r ON r.run_id=lr.run_id AND r.supplier_id=lr.supplier_id
    JOIN sku s ON s.code_1c=r.code_1c JOIN supplier sup ON sup.id=r.supplier_id
    WHERE r.urgency IN ('critical','soon') AND r.qty_recommended>0
    ORDER BY CASE r.urgency WHEN 'critical' THEN 0 ELSE 1 END,r.code_1c LIMIT 5`).all(orgId) as
    { code_1c: string; name: string; urgency: string; components: string; lead_time_days: number; risk_count: number }[];
  const riskCount = risks[0]?.risk_count ?? 0;
  const top = risks.map((row) => ({ code_1c: row.code_1c, name: row.name,
    days_of_cover: (JSON.parse(row.components) as { days_of_cover?: number }).days_of_cover ?? null,
    lead_time_days: row.lead_time_days, urgency: row.urgency }));
  const stats = database.prepare("SELECT SUM(CASE WHEN autonomy='auto' THEN 1 ELSE 0 END) AS auto,SUM(CASE WHEN autonomy='escalated' THEN 1 ELSE 0 END) AS needs_you FROM agent_action WHERE org_id=?")
    .get(orgId) as { auto: number | null; needs_you: number | null };
  const auto = stats.auto ?? 0;
  const needsYou = stats.needs_you ?? 0;
  const orders = database.prepare("SELECT id,supplier_id,state,total_cost,eta FROM purchase_order ORDER BY eta LIMIT 8")
    .all() as { id: string; supplier_id: string; state: string; total_cost: string | null; eta: string | null }[];
  const runs = database.prepare("SELECT id,finished_at,recommended FROM calc_run ORDER BY finished_at DESC LIMIT 5")
    .all() as { id: string; finished_at: string | null; recommended: number }[];
  const background = database.prepare("SELECT id,summary_ru,at FROM agent_action WHERE autonomy='auto' ORDER BY at DESC LIMIT 5").all();
  const feedNext = database.prepare("SELECT id,kind,code_1c,at FROM world_event WHERE state='scripted' ORDER BY seq LIMIT 3").all();
  const decision = queue.items[0] ?? null;
  const lead = decision ? `Нужно решение: ${decision.title}.` : riskCount ? `Под наблюдением ${riskCount} позиций с риском дефицита.` : "Новых решений нет; расчёт пополнения готов к запуску.";
  return { lead, decision, queue_count: queue.items.length,
    pulse: { money, stockout_risk: { count: riskCount, top }, decisions: queue.items.length,
      cash_committed: (money as { committed_by_supplier?: unknown }).committed_by_supplier ?? [],
      agents: { auto, needs_you: needsYou, ratio: auto + needsYou ? auto / (auto + needsYou) : 0 } },
    commitments: [
      ...orders.map((order) => ({ id: order.id, kind: "po", title: `Заказ ${order.supplier_id}`, next_event: order.eta,
        amount: order.total_cost ? { amount: order.total_cost, currency: "KZT" } : null, owner: "Закупки", state: order.state })),
      ...runs.map((run) => ({ id: run.id, kind: "run", title: `Расчёт: ${run.recommended} рекомендаций`, next_event: run.finished_at,
        amount: null, owner: "Агент", state: "done" })),
    ], background, feed_next: feedNext, ...(decision || riskCount || orders.length || runs.length ? {} : { empty_reason: "Нет расчётов и новых событий" }) };
}

export async function ordersView(_orgId: string, database: DatabaseSync = db()): Promise<{ orders: Record<string, unknown>[]; empty_reason?: string }> {
  const orders = database.prepare("SELECT * FROM purchase_order ORDER BY eta DESC,id DESC").all() as Record<string, unknown>[];
  const shaped = orders.map((order) => ({ ...order,
    total_cost: order.total_cost ? { amount: order.total_cost, currency: "KZT" } : null,
    lines: database.prepare("SELECT code_1c,qty,unit_cost,rationale_ru FROM purchase_order_line WHERE po_id=? ORDER BY code_1c").all(order.id as string) }));
  return shaped.length ? { orders: shaped } : { orders: [], empty_reason: "Заказов пока нет" };
}
