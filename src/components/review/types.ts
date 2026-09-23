import { parseJson, type Components, type Money, type Quantity, type ResultAxes } from "@/components/purchase/types";

export type ProposalState = "draft" | "needs_review" | "approved" | "stale" | "rejected" | "delivered" | "delivery_failed";
export type OrderLine = { id?: string | number; recommendation_id?: string; code_1c: string; name?: string; article?: string; qty: number; unit_cost?: string | null; rationale_ru?: string; moq?: Quantity; components?: Components };
export type Order = { id: string; supplier_id: string; run_id?: string; state: "draft" | "approved" | "exported"; total_qty: Quantity; total_cost?: Money | string | null; currency?: string; cost_known_lines: number; eta?: string | null; version: number; lines: OrderLine[]; export_path?: string | null };
export type ProposalPayload = { supplier_id?: string; run_id?: string; po_id?: string; lines?: OrderLine[]; cost_known_lines?: number; code_1c?: string; doc_no?: string; ym?: string; state?: "excluded" | "kept"; changes?: Record<string, unknown>; current?: Record<string, unknown>; before?: Record<string, unknown>; after?: Record<string, unknown> };
export type Proposal = ResultAxes & { id: string; kind: "supplier_order" | "outlier_review" | "param_change"; subject_id?: string; subject_version?: number; payload: ProposalPayload; affects: unknown[]; sources: unknown[]; supersedes_id?: string | null; state: ProposalState; version: number; rationale_ru: string; money_at_stake?: Money | null; created_at?: string; };
export type QueueItem = { id: string; kind: string; title: string; why: string; sources: unknown[]; money_at_stake?: Money | null; options: { key: string; label: string; effect: string }[]; href: string; since: string };
export type QueueResponse = ResultAxes & { items: QueueItem[]; empty_reason?: string };
export type ProposalsResponse = ResultAxes & { proposals: Proposal[] };
export type OrderResponse = ResultAxes & { order: Order };
export type Artifact = ResultAxes & { id: string; title_ru: string; markdown: string; provider?: string; model_version?: string; consistency?: string; created_at?: string; sources?: string[] };
export const kindLabels = { supplier_order: "Заказ поставщику", outlier_review: "Разовый заказ", param_change: "Параметры расчёта" };
export const approvalVerbs = { supplier_order: "Создать черновик заказа", outlier_review: "Подтвердить решение", param_change: "Применить параметры" };
export function hydrateProposal(value: Proposal): Proposal {
  return { ...value, payload: parseJson(value.payload, {}), sources: parseJson(value.sources, []), affects: parseJson(value.affects, []), money_at_stake: parseJson(value.money_at_stake, null) };
}
export function changedLines(lines: OrderLine[], previous: OrderLine[] = []) {
  return lines.map(line => ({ line, before: previous.find(p => p.code_1c === line.code_1c), changed: !previous.some(p => p.code_1c === line.code_1c && p.qty === line.qty && p.unit_cost === line.unit_cost) }));
}
export function decisionBody(version: number, quantities: Record<string, string>, lines: OrderLine[]) {
  const adjustments = Object.entries(quantities).map(([code_1c, value]) => {
    if (!value.trim() || !Number.isSafeInteger(Number(value)) || Number(value) < 0) throw new Error(`Укажите целое количество не меньше нуля для ${code_1c}.`);
    return { code_1c, qty: Number(value) };
  }).filter(a => lines.some(line => line.code_1c === a.code_1c && line.qty !== a.qty));
  return { proposal_version: version, ...(adjustments.length ? { adjustments } : {}) };
}
