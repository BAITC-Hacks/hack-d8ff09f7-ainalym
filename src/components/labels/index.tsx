import type { ReactNode } from "react";
import styles from "./labels.module.css";
export type TruthAxes = { provenance?: "partner_anonymised" | "synthetic"; ai?: "live" | "rules" | "replay" | "unavailable"; external?: "export_only" | "local_simulator" | "unavailable" };
export const LABELS = {
  provenance: { partner_anonymised: "Данные партнёра · обезличены", synthetic: "Синтетические данные" },
  ai: { live: "Живой AI", rules: "Правила без LLM", replay: "Воспроизведение · записанное решение", unavailable: "Провайдер недоступен" },
  external: { export_only: "Экспорт для 1С (файл)", local_simulator: "Локальный симулятор", unavailable: "Внешнее действие недоступно" },
  task: { preparing: "Готовлю", awaiting_supplier: "Ждём поставщика", needs_review: "Нужна ваша проверка", ready_to_handover: "Готово к передаче", handed_over: "Передано", handover_failed: "Ошибка передачи" },
  proposal: { draft: "черновик", needs_review: "ждёт вас", approved: "утверждено", stale: "устарело — есть новая версия", rejected: "отклонено", delivered: "передано", delivery_failed: "ошибка передачи" },
  urgency: { critical: "критично", soon: "скоро", normal: "планово", none: "не требуется" },
} as const;
export function Chip({ children, tone = "neutral", title }: { children: ReactNode; tone?: "neutral" | "warning" | "danger"; title?: string }) { return <span className={`${styles.chip} ${tone === "neutral" ? "" : styles[tone]}`} title={title}>{children}</span>; }
export function ModeChip({ mode, ai }: { mode?: string; ai?: TruthAxes["ai"] }) { return <Chip title={mode === "offline" ? "Offline walkthrough" : ai}>{mode === "offline" ? "Офлайн-режим · записанные решения" : ai ? LABELS.ai[ai] : "Режим уточняется"}</Chip>; }
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
