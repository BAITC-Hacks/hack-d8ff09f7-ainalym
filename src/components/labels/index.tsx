import type { ReactNode } from "react";
import styles from "./labels.module.css";
export type TruthAxes = { provenance?: "partner_anonymised" | "synthetic"; ai?: "live" | "rules" | "replay" | "unavailable"; external?: "export_only" | "local_simulator" | "unavailable" };
/** Result metadata only: never infer historical execution from the current provider mode. */
export function resultAxes(value?: TruthAxes & { axes?: TruthAxes; labels?: TruthAxes } | null): TruthAxes {
  return { provenance: value?.axes?.provenance ?? value?.labels?.provenance ?? value?.provenance, ai: value?.axes?.ai ?? value?.labels?.ai ?? value?.ai, external: value?.axes?.external ?? value?.labels?.external ?? value?.external };
}
export const LABELS = {
  provenance: { partner_anonymised: "Данные партнёра · обезличены", synthetic: "Синтетические данные" },
  ai: { live: "Живой AI", rules: "Правила без LLM", replay: "Воспроизведение · записанное решение", unavailable: "Провайдер недоступен" },
  external: { export_only: "Экспорт для 1С (файл)", local_simulator: "Локальный симулятор", unavailable: "Внешнее действие недоступно" },
  task: { preparing: "Готовлю", awaiting_supplier: "Ждём поставщика", needs_review: "Нужна ваша проверка", ready_to_handover: "Готово к передаче", handed_over: "Передано", handover_failed: "Ошибка передачи" },
  proposal: { draft: "черновик", needs_review: "ждёт вас", approved: "утверждено", stale: "устарело — есть новая версия", rejected: "отклонено", delivered: "передано", delivery_failed: "ошибка передачи" },
  urgency: { critical: "критично", soon: "скоро", normal: "планово", none: "не требуется" },
  role: { purchasing_manager: "менеджер по закупкам", manager: "менеджер", agent: "агент", judge: "жюри", system: "система", supplier: "поставщик" },
  order: { draft: "черновик — не отправлен", approved: "утверждено", exported: "передано в 1С", sent: "отправлен поставщику", confirmed: "подтверждён поставщиком", received: "получен", done: "готово", cancelled: "отменён" },
} as const;
/** Technical enum → purchasing language; unknown tokens fall back to a neutral phrase, never to the raw enum. */
const HUMAN: Record<string, string> = {
  ...Object.fromEntries(Object.entries({ preparing: "готовится", awaiting_supplier: "ждём поставщика", needs_review: "ждёт решения", ready_to_handover: "готово к передаче", handed_over: "передано", handover_failed: "ошибка передачи", proposed: "ждёт решения", stale: "устарело", rejected: "отклонено", delivered: "передано", delivery_failed: "ошибка передачи", adjusted: "скорректировано" })),
  purchasing_manager: "менеджер по закупкам", supplier_reply: "ответ поставщика", order_drafted: "черновик заказа", order_approved: "заказ утверждён", proposal_created: "предложение подготовлено", recommendation_run: "расчёт выполнен", sales_day: "продажи за день", stock_snapshot: "снимок остатков", in_transit_update: "товар в пути", price_update: "изменение цены", judge_message: "разовый заказ", export_only: "экспорт для 1С", local_simulator: "локальный симулятор", partner_anonymised: "данные партнёра",
};
export function roleLabel(role?: string | null): string { return role ? LABELS.role[role as keyof typeof LABELS.role] ?? HUMAN[role] ?? "сотрудник" : "—"; }
export function orderStateLabel(state?: string | null): string { return state ? LABELS.order[state as keyof typeof LABELS.order] ?? HUMAN[state] ?? "в работе" : "—"; }
/** Rewrites enum tokens and internal routes inside free text so that nothing technical reaches the screen. */
export function humanize(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/\/api\/[a-z0-9_\/-]+/gi, "система")
    .replace(/\b(TK|PR|PO|WE|RUN|SCRIPT)-[0-9a-f-]{8,}\b/gi, m => ({ TK: "задача", PR: "предложение", PO: "заказ", WE: "событие", RUN: "запуск", SCRIPT: "сценарий" })[m.slice(0, m.indexOf("-")).toUpperCase()] ?? "запись")
    .replace(/\b[a-z]+(?:_[a-z0-9]+)+\b/g, m => HUMAN[m] ?? m.replace(/_/g, " "))
    .replace(/\b(unchanged|changed|failed|pending|skipped|done|ok|draft|approved|rejected|stale)\b/g, m => PLAIN[m] ?? m);
}
const PLAIN: Record<string, string> = { unchanged: "без изменений", changed: "изменилось", failed: "ошибка", pending: "в работе", skipped: "пропущено", done: "готово", ok: "выполнено", draft: "черновик", approved: "утверждено", rejected: "отклонено", stale: "устарело" };
export function Chip({ children, tone = "neutral", title }: { children: ReactNode; tone?: "neutral" | "warning" | "danger"; title?: string }) { return <span className={`${styles.chip} ${tone === "neutral" ? "" : styles[tone]}`} title={title}>{children}</span>; }
export function ModeChip({ mode, ai }: { mode?: string; ai?: TruthAxes["ai"] }) { return <Chip title={mode === "offline" ? "Offline walkthrough" : ai}>{mode === "offline" ? "Офлайн-режим · записанные решения" : mode === "unavailable" ? "Режимы недоступны" : ai ? LABELS.ai[ai] : "Режим уточняется"}</Chip>; }
export function TruthAxisLabels({ axes, provenance, ai, external }: TruthAxes & { axes?: TruthAxes }) {
  const value = axes ?? { provenance, ai, external };
  return <div className={styles.axes} aria-label="Источник, AI, внешнее действие">
    <Chip title={`provenance=${value.provenance ?? "unknown"}`}>{value.provenance ? LABELS.provenance[value.provenance] : "Источник не указан"}</Chip>
    <Chip title={`ai=${value.ai ?? "unknown"}`}>{value.ai ? LABELS.ai[value.ai] : "Режим AI не указан"}</Chip>
    <Chip title={`external=${value.external ?? "unknown"}`}>{value.external ? LABELS.external[value.external] : "Внешнее действие не указано"}</Chip>
  </div>;
}
export const TruthLabels = TruthAxisLabels;
export function TaskStateChip({ state }: { state: string }) { const label = LABELS.task[state as keyof typeof LABELS.task]; return <Chip tone={state === "handover_failed" ? "danger" : state === "needs_review" ? "warning" : "neutral"}>{label ?? "Состояние не указано"}</Chip>; }
export function ProposalStateChip({ state }: { state: string }) { return <Chip tone={state === "delivery_failed" ? "danger" : state === "needs_review" || state === "stale" ? "warning" : "neutral"}>{LABELS.proposal[state as keyof typeof LABELS.proposal] ?? "Состояние не указано"}</Chip>; }
export function UrgencyChip({ urgency }: { urgency: string }) { return <Chip tone={urgency === "critical" ? "danger" : urgency === "soon" ? "warning" : "neutral"}>{LABELS.urgency[urgency as keyof typeof LABELS.urgency] ?? "Срочность не указана"}</Chip>; }
export function AgentsLabel() { return <Chip title="Agents · partner data">Агенты · данные партнёра</Chip>; }
export function WorldLabel() { return <Chip title="World simulator · synthetic event">Симулятор мира — синтетическое событие</Chip>; }
