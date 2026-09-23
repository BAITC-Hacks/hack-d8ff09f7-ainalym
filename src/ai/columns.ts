import { db } from "../db/client";
import { decide } from "./decisions";

export type ColumnIntent = "category" | "supplier_terms" | "urgency" | "unsupported";
export interface ColumnCell {
  code_1c: string;
  value: string | null;
  result_state: "decided" | "insufficient" | "unsupported" | "provider_error" | "missing_inputs";
  sources: string[];
  provider?: string;
  model_version?: string;
  decision_record_id?: string;
}
export interface SemanticColumn {
  header: string;
  intent: ColumnIntent;
  result_state: "ready" | "missing_inputs" | "provider_error";
  rows: ColumnCell[];
}

export function columnIntent(header: string): ColumnIntent {
  const value = header.trim().toLocaleLowerCase();
  if (/категор|category|группа товаров/.test(value)) return "category";
  if (/условия оплаты|условия поставщика|supplier terms|payment terms|предоплата/.test(value)) return "supplier_terms";
  if (/срочност|urgency|приоритет/.test(value)) return "urgency";
  return "unsupported";
}

function termsText(raw: string): string | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "string") return parsed.trim() || null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Object.keys(parsed).length) return JSON.stringify(parsed);
    return null;
  } catch { return raw.trim() || null; }
}

export async function buildSemanticColumn(header: string, codes: string[]): Promise<SemanticColumn> {
  const intent = columnIntent(header);
  if (intent === "unsupported") return {
    header, intent, result_state: "missing_inputs",
    rows: codes.map(code_1c => ({ code_1c, value: null, result_state: "missing_inputs", sources: [] })),
  };
  const rows: ColumnCell[] = [];
  for (const code_1c of codes) {
    const sku = db().prepare(`SELECT s.code_1c,s.name,s.category,s.supplier_id,p.terms
      FROM sku s JOIN supplier p ON p.id=s.supplier_id WHERE s.code_1c=?`).get(code_1c) as
      { code_1c: string; name: string; category: string | null; supplier_id: string; terms: string } | undefined;
    if (!sku) {
      rows.push({ code_1c, value: null, result_state: "missing_inputs", sources: [] });
      continue;
    }
    if (intent === "category") {
      if (sku.category) {
        rows.push({ code_1c, value: sku.category, result_state: "decided", sources: [`sku:${code_1c}`], provider: "source" });
      } else if (sku.supplier_id !== "IEK" || !sku.name.trim()) {
        rows.push({ code_1c, value: null, result_state: "missing_inputs", sources: [`sku:${code_1c}`] });
      } else {
        const decision = await decide("category_hint", code_1c, { name: sku.name });
        rows.push({ code_1c, value: decision.answer, result_state: decision.result_state,
          sources: [`sku:${code_1c}`, decision.id], provider: decision.provider,
          model_version: decision.model_version, decision_record_id: decision.id });
      }
      continue;
    }
    if (intent === "supplier_terms") {
      const text = termsText(sku.terms);
      if (!text) {
        rows.push({ code_1c, value: null, result_state: "missing_inputs", sources: [`supplier:${sku.supplier_id}`] });
      } else {
        const decision = await decide("supplier_terms_hint", `supplier:${sku.supplier_id}`, { text });
        rows.push({ code_1c, value: decision.answer, result_state: decision.result_state,
          sources: [`supplier:${sku.supplier_id}`, decision.id], provider: decision.provider,
          model_version: decision.model_version, decision_record_id: decision.id });
      }
      continue;
    }
    const recommendation = db().prepare(`SELECT id,urgency FROM recommendation WHERE code_1c=?
      ORDER BY rowid DESC LIMIT 1`).get(code_1c) as { id: string; urgency: string } | undefined;
    rows.push(recommendation
      ? { code_1c, value: recommendation.urgency, result_state: "decided", sources: [recommendation.id], provider: "engine" }
      : { code_1c, value: null, result_state: "missing_inputs", sources: [`sku:${code_1c}`] });
  }
  return { header, intent,
    result_state: rows.some(row => row.result_state === "provider_error") ? "provider_error"
      : rows.some(row => row.result_state === "missing_inputs" || row.result_state === "insufficient" || row.result_state === "unsupported") ? "missing_inputs" : "ready",
    rows };
}
