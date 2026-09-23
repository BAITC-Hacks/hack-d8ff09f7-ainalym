/* Document layer — JSON shapes shared with the intake API (ops brief DOCS_INTAKE). Fields may be added by the API, never renamed. */
import type { Tone } from "@/components/v2/ui";

export type SupplyRoute = "domestic" | "eaeu" | "import";
export type Stage = "contract" | "invoice" | "transport" | "import" | "receipt";
export type DocumentKind = "invoice" | "delivery_note" | "transport" | "receipt" | "customs" | "other";
export type DocumentState = "received" | "extracted" | "matched" | "discrepancy" | "accepted";
export type ExtractionMode = "deterministic" | "openai" | "replay" | "unavailable";
export type LineStatus = "ok" | "qty_diff" | "price_diff" | "missing_in_po" | "missing_in_doc";
export type ItemStatus = "present" | "missing" | "draft" | "discrepancy";

export type ExtractedLine = { code_1c: string | null; article: string | null; name: string; unit: string | null; qty: string; price: string | null; amount: string | null };
export type ExtractedDocument = { number: string | null; date: string | null; supplier: string | null; buyer: string | null; currency: string | null; lines: ExtractedLine[]; note_ru?: string };
export type MatchedLine = { code_1c: string | null; article: string | null; name: string; qty_doc: string; qty_po: string | null; qty_received: string | null; price_doc: string | null; unit_cost_po: string | null; status: LineStatus };
export type Match = { lines: MatchedLine[]; summary: { matched: number; discrepancies: number; total_doc: string; total_po: string }; three_way: boolean };
export type IntakeDocument = {
  id: string; po_id: string | null; supplier_id: string | null; kind: DocumentKind | string; source: "upload" | "fixture" | "world_event" | string;
  file_name: string | null; mime: string | null; sha256: string | null; size?: number | null; extracted: ExtractedDocument; extraction_mode: ExtractionMode | string | null;
  match: Match | Record<string, never>; state: DocumentState | string; created_at: string; version: number;
};
export type PackageItem = { key: string; title_ru: string; stage: Stage; required: boolean; source: "supplier" | "carrier" | "agent_draft" | "warehouse" | "state_system"; status: ItemStatus; document_id?: string };
export type OrderPackage = { route: SupplyRoute; route_note_ru?: string | null; items: PackageItem[]; drafts: Record<string, unknown>; stage_rail: { stage: Stage; state: ItemStatus }[] };

export const hasMatch = (doc: IntakeDocument): doc is IntakeDocument & { match: Match } => Array.isArray((doc.match as Match).lines);
export const needsAttention = (doc: IntakeDocument) => doc.state !== "accepted";

/* ---------- RU labels ---------- */
export const KIND_RU: Record<string, string> = { invoice: "счёт", delivery_note: "накладная", transport: "транспортный документ", receipt: "акт приёмки", customs: "таможенный документ", other: "прочее" };
export const STATE_RU: Record<string, { label: string; tone: Tone }> = {
  received: { label: "получен", tone: "neutral" }, extracted: { label: "извлечено", tone: "neutral" }, matched: { label: "сверено", tone: "good" },
  discrepancy: { label: "расхождение", tone: "warn" }, accepted: { label: "принят", tone: "good" },
};
export const LINE_RU: Record<LineStatus, { label: string; tone: Tone }> = {
  ok: { label: "ok", tone: "good" }, qty_diff: { label: "расхождение по количеству", tone: "warn" }, price_diff: { label: "расхождение по цене", tone: "warn" },
  missing_in_po: { label: "нет в заказе", tone: "bad" }, missing_in_doc: { label: "нет в документе", tone: "bad" },
};
export const MODE_RU: Record<string, string> = { deterministic: "извлечено детерминированно", openai: "извлечено моделью", replay: "воспроизведение примера", unavailable: "без ключа извлечение недоступно" };
export const ITEM_RU: Record<ItemStatus, { label: string; tone: Tone }> = {
  present: { label: "есть", tone: "good" }, missing: { label: "нет", tone: "neutral" }, draft: { label: "черновик агента", tone: "accent" }, discrepancy: { label: "расхождение", tone: "warn" },
};
export const ROUTE_RU: Record<SupplyRoute, string> = { domestic: "внутри РК", eaeu: "ЕАЭС", import: "импорт (третьи страны)" };
export const STAGE_RU: Record<Stage, string> = { contract: "договор", invoice: "счёт", transport: "транспорт", import: "ввоз", receipt: "приёмка" };
export const SOURCE_RU: Record<PackageItem["source"], string> = { supplier: "от поставщика", carrier: "от перевозчика", agent_draft: "готовит агент", warehouse: "склад", state_system: "государственная система" };
export const DRAFT_RU: Record<string, string> = { form_328_00: "Заявление о ввозе и уплате косвенных налогов — форма 328.00", dt_draft: "Декларация на товары (ДТ) — черновик для ИС «Кеден»" };
export const FIELD_RU: Record<string, string> = {
  label: "статус", seller: "продавец", buyer: "покупатель", contract: "договор", invoice_number: "счёт №", invoice_date: "дата счёта", currency: "валюта",
  declarant: "декларант", sender: "отправитель", name: "наименование", unit: "ед.", qty: "количество", value: "стоимость", amount: "стоимость", vat_12_percent: "НДС 12 %",
  tn_ved_eaeu_suggestion: "ТН ВЭД ЕАЭС (предложение)", suggestion_level: "уровень", needs_review: "требует проверки", invoice_value: "фактурная стоимость", country_origin: "страна происхождения",
};
export const MONEY_FIELDS = new Set(["value", "amount", "vat_12_percent", "invoice_value"]);
