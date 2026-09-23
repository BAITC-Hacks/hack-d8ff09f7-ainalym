import type { TruthAxes } from "@/components/labels";

export type Quantity = number | string | null | undefined;
export type Money = { amount: string; currency: string };
export type ResultAxes = TruthAxes & { axes?: TruthAxes; labels?: TruthAxes };
export type Outlier = { id?: string; doc_no: string; at?: string; qty: Quantity; rule?: string; state?: string };
export type Components = {
  base_rate?: Quantity; growth?: Quantity; horizon_days?: number; forecast_qty?: Quantity;
  monthly_forecast?: Record<string, number>; safety?: Quantity; on_hand?: Quantity; in_transit?: Quantity; approved_order_qty?: Quantity;
  stockout_uplift?: Quantity; stockout_months?: string[]; outliers_excluded?: Outlier[];
  raw_need?: Quantity; moq?: Quantity; days_of_cover?: Quantity; season_source?: string;
  source_months?: number; sales_lines?: number; stock_month?: string; transit_rows?: number;
};
export type Recommendation = {
  id: string; run_id?: string; code_1c: string; supplier_id: string; name: string;
  on_hand: Quantity; in_transit: Quantity; forecast_qty?: Quantity; qty_recommended: Quantity;
  qty_adjusted?: Quantity; moq?: Quantity; urgency: string; rationale_ru: string; components: Components;
  outliers_excluded?: Outlier[]; stockout_months?: string[]; version?: number; state?: string; proposal_id?: string;
};
export type RecommendationGroup = { supplier_id: string; total_qty: Quantity; total_cost?: Money | string | null; cost_known_lines: number; rows: Recommendation[] };
export type RecommendationsResponse = ResultAxes & { groups: RecommendationGroup[]; run_id?: string; empty_reason?: string };
export type AgentAction = { id: string; kind: string; summary_ru: string; rationale_ru?: string; sources?: unknown[]; autonomy: string; result: string; at: string; provider?: string; model_version?: string; code_1c?: string; po_id?: string };
export type LedgerResponse = ResultAxes & { rows?: AgentAction[]; actions?: AgentAction[]; stats?: { auto: number; needs_you: number } };
export type SeriesPoint = { ym: string; qty_file: Quantity; qty_regular: Quantity; stock: Quantity; stockout: boolean | number; outliers?: Outlier[] };
export type SkuResponse = ResultAxes & {
  sku: { code_1c: string; name: string; supplier_id: string; article?: string; unit?: string; moq?: Quantity; unit_cost?: string | null };
  series: SeriesPoint[]; forecast?: { method_ru?: string; base_rate?: Quantity; growth?: Quantity; stockout_uplift?: Quantity; safety?: Quantity; monthly_forecast?: Record<string, number> } | null;
  recommendation?: Recommendation | null; in_transit: { id?: string; po_ref: string; qty: Quantity; expected_at?: string | null }[]; timeline: AgentAction[];
};
export function number(value: Quantity, digits = 2): string {
  if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return "Неизвестно";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(Number(value));
}
export function money(value?: Money | string | null, currency = "KZT"): string {
  if (value === null || value === undefined || value === "") return "Себестоимость не задана";
  const amount = typeof value === "string" ? value : value.amount;
  const code = typeof value === "string" ? currency : value.currency;
  // Format decimal strings without coercing large monetary values to binary floats.
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(amount);
  if (!match) return "Сумма не указана";
  return `${match[1]}${match[2].replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f")}${match[3] ? `,${match[3]}` : ""}\u2009${code === "KZT" ? "₸" : code}`;
}
export function date(value?: string | null): string {
  if (!value) return "Дата не указана";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Almaty" }).format(parsed);
}
export function axesOf(result?: ResultAxes): TruthAxes {
  return result?.axes ?? result?.labels ?? { provenance: result?.provenance, ai: result?.ai, external: result?.external };
}
export function sourceText(source: unknown): string {
  if (typeof source === "string") return source;
  if (source && typeof source === "object") return Object.entries(source).filter(([, v]) => typeof v === "string" || typeof v === "number").map(([k, v]) => `${k}: ${v}`).join(" · ");
  return "Источник без описания";
}
export function parseJson<T>(value: T | string | null | undefined, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}
