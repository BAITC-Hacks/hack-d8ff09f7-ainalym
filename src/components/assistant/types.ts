import type { TruthAxes } from "@/components/labels";

export type AssistantScope = { org_id: string; supplier_id?: string; code_1c?: string };
export type ToolName = "what_needs_me" | "what_changed" | "recommend_for" | "explain_sku";
export const TOOLS: { name: ToolName; title: string; key: string }[] = [
  { name: "what_needs_me", title: "Что нужно от меня?", key: "1" },
  { name: "what_changed", title: "Что изменилось?", key: "2" },
  { name: "recommend_for", title: "Что заказать по …", key: "3" },
  { name: "explain_sku", title: "Объясни код …", key: "4" },
];
export type AssistantResult = {
  ok?: boolean; reply_ru?: string; tool?: ToolName; result?: AssistantResult;
  labels?: Record<string, unknown>; axes?: TruthAxes; state_version?: number; replayed?: boolean;
  items?: { id: string; title: string; href?: string; meta?: string; image?: string | null; code?: string }[];
  summary_ru?: string; changes?: { object: string; id: string; field: string; before: unknown; after: unknown }[];
  run_id?: string; recommended?: number; top?: { code_1c: string; qty: number; urgency: string }[];
  code_1c?: string; rationale_ru?: string | null; components?: Record<string, unknown>;
  outliers_excluded?: unknown[]; stockout_months?: unknown[];
  /** 1–2 next-step offers tied to the data; the shell renders them as tappable chips under the answer. */
  followups?: string[];
};

// L5 sends canonical EN labels; the shell consumes the §5 enum values.
// An unknown/missing axis stays unknown instead of borrowing the current mode.
export function resultAxes(response: AssistantResult): TruthAxes {
  const data = response.result ?? response;
  const labels = { ...data.labels, ...response.labels };
  const value = { ...labels, ...data.axes, ...response.axes };
  const provenance = ({ partner_anonymised: "partner_anonymised", synthetic: "synthetic", "Partner data · anonymised": "partner_anonymised", "Данные партнёра · обезличены": "partner_anonymised", "Synthetic data": "synthetic" } as const)[String(value.provenance) as "partner_anonymised"];
  const ai = ({ live: "live", rules: "rules", replay: "replay", unavailable: "unavailable", "Live AI": "live", "Rules, no LLM": "rules", "Replay · recorded decision": "replay", "Provider unavailable": "unavailable" } as const)[String(value.ai) as "live"];
  const external = ({ export_only: "export_only", local_simulator: "local_simulator", unavailable: "unavailable", "Export for 1C (file)": "export_only", "Local simulator": "local_simulator" } as const)[String(value.external) as "export_only"];
  return { provenance, ai, external };
}

export function localHref(href?: string): string | undefined {
  return href?.startsWith("/") && !href.startsWith("//") && !href.includes("\\") ? href : undefined;
}
