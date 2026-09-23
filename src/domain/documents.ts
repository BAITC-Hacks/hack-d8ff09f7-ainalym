import Decimal from "decimal.js";
import * as XLSX from "xlsx";
import { formatAmount } from "./money";

export type SupplyRoute = "domestic" | "eaeu" | "import";
export type Stage = "contract" | "invoice" | "transport" | "import" | "receipt";
export type PackageItem = { key: string; title_ru: string; stage: Stage; required: boolean; source: "supplier" | "carrier" | "agent_draft" | "warehouse" | "state_system" };
export type ExtractedLine = { code_1c: string | null; article: string | null; name: string; unit: string | null; qty: string; price: string | null; amount: string | null };
export type ExtractedDocument = { number: string | null; date: string | null; supplier: string | null; buyer: string | null; currency: string | null; lines: ExtractedLine[]; note_ru?: string };
export type OrderLine = { code_1c: string; article?: string | null; name: string; qty: string | number; unit_cost?: string | null; unit?: string | null };
export type ReceiptLine = { code_1c?: string | null; article?: string | null; name?: string; qty: string | number };

const item = (key: string, title_ru: string, stage: Stage, source: PackageItem["source"], required = true): PackageItem => ({ key, title_ru, stage, required, source });
const receipt = item("warehouse_receipt", "Акт приёмки на склад", "receipt", "warehouse");
const packages: Record<SupplyRoute, PackageItem[]> = {
  domestic: [
    item("payment_invoice", "Счёт на оплату", "invoice", "supplier"), item("contract", "Договор", "contract", "supplier"),
    item("esf", "ЭСФ (электронный счёт-фактура)", "invoice", "state_system"), item("delivery_note", "Накладная на отпуск запасов", "transport", "supplier"), receipt,
  ],
  eaeu: [
    item("contract", "Договор", "contract", "supplier"), item("invoice", "Счёт / инвойс", "invoice", "supplier"),
    item("delivery_note", "Товарная накладная (УПД / ТОРГ-12)", "transport", "supplier"), item("transport", "CMR / ТТН", "transport", "carrier"),
    item("form_328_00", "Заявление о ввозе и уплате косвенных налогов (форма 328.00)", "import", "agent_draft"),
    item("form_320_00", "НДС при импорте 12 % (форма 320.00)", "import", "state_system"),
    item("statistical_form", "Статистическая форма учёта перемещения товаров", "import", "state_system"),
    item("conformity", "Сертификат / декларация соответствия ЕАЭС", "import", "supplier"), receipt,
  ],
  import: [
    item("contract", "Контракт", "contract", "supplier"), item("invoice", "Инвойс", "invoice", "supplier"),
    item("packing_list", "Packing list", "transport", "supplier"), item("transport", "Транспортный документ (CMR / ж/д накладная / коносамент)", "transport", "carrier"),
    item("origin_certificate", "Сертификат происхождения", "import", "supplier"),
    item("tn_ved", "Коды ТН ВЭД ЕАЭС по строкам — предложение агента, проверка декларанта", "import", "agent_draft"),
    item("dt_draft", "Декларация на товары (ДТ) через ИС «Кеден»", "import", "agent_draft"),
    item("customs_payments", "Таможенные платежи (пошлина, НДС 12 %, сбор)", "import", "state_system"),
    item("conformity", "Сертификаты соответствия", "import", "supplier"), receipt,
  ],
};
export function packageForRoute(route: SupplyRoute): PackageItem[] { return packages[route].map(x => ({ ...x })); }

const canon = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[^\p{L}\p{N}]+/gu, "");
const money = (value: unknown): string | null => {
  const raw = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".");
  return /^-?\d+(?:\.\d+)?$/.test(raw) ? formatAmount(new Decimal(raw)) : null;
};
const quantity = (value: unknown): string => {
  const raw = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".");
  return /^-?\d+(?:\.\d+)?$/.test(raw) ? new Decimal(raw).toString() : "0";
};
const headerKind = (header: string): keyof ExtractedLine | null => {
  const h = canon(header);
  if (/^(код1с|код|номенклатуракод)$/.test(h)) return "code_1c";
  if (/^(артикул|артикулпоставщика|арт)$/.test(h)) return "article";
  if (/^(наименование|товар|номенклатура|описание)$/.test(h)) return "name";
  if (/^(колво|количество|количествошт|qty)$/.test(h)) return "qty";
  if (/^(ед|едизм|единица|единицаизмерения)$/.test(h)) return "unit";
  if (/^(цена|ценаед|ценазаединицу|price)$/.test(h)) return "price";
  if (/^(сумма|стоимость|итого|amount)$/.test(h)) return "amount";
  return null;
};
function parseRows(rows: unknown[][]): ExtractedDocument {
  const result: ExtractedDocument = { number: null, date: null, supplier: null, buyer: null, currency: null, lines: [] };
  for (const row of rows.slice(0, 12)) {
    const line = row.map(v => String(v ?? "")).join(" ");
    const number = /(?:сч[её]т|инвойс|invoice)\s*(?:на оплату)?\s*[№#]?\s*([\w/-]+)/i.exec(line);
    if (number && !result.number) result.number = number[1];
    const date = /\b\d{2}[.\-/]\d{2}[.\-/]\d{4}\b/.exec(line);
    if (date && !result.date) result.date = date[0];
    if (/поставщик\s*:/i.test(line)) result.supplier = line.split(/поставщик\s*:/i)[1]?.trim() || null;
    if (/покупатель\s*:/i.test(line)) result.buyer = line.split(/покупатель\s*:/i)[1]?.trim() || null;
    if (/валюта\s*:/i.test(line)) result.currency = line.split(/валюта\s*:/i)[1]?.trim() || null;
  }
  const headerIndex = rows.findIndex(row => row.map(v => headerKind(String(v ?? ""))).includes("name") && row.map(v => headerKind(String(v ?? ""))).includes("qty"));
  if (headerIndex < 0) return result;
  const columns = rows[headerIndex].map(v => headerKind(String(v ?? "")));
  for (const row of rows.slice(headerIndex + 1)) {
    const get = (key: keyof ExtractedLine): unknown => { const at = columns.indexOf(key); return at < 0 ? null : row[at]; };
    const name = String(get("name") ?? "").trim();
    if (!name || /^(итого|всего|ндс)/i.test(name)) continue;
    const qty = quantity(get("qty"));
    if (qty === "0") continue;
    const price = money(get("price"));
    const amount = money(get("amount")) ?? (price ? formatAmount(new Decimal(price).times(qty)) : null);
    result.lines.push({ code_1c: String(get("code_1c") ?? "").trim() || null, article: String(get("article") ?? "").trim() || null, name,
      unit: String(get("unit") ?? "").trim() || null, qty, price, amount });
  }
  return result;
}
function delimited(text: string): unknown[][] {
  const first = text.split(/\r?\n/).find(Boolean) || "";
  const delimiter = [";", "\t", ","].sort((a,b) => first.split(b).length - first.split(a).length)[0];
  return XLSX.utils.sheet_to_json(XLSX.read(text, { type: "string", FS: delimiter }).Sheets.Sheet1, { header: 1, raw: false, defval: "" }) as unknown[][];
}
export function extractDeterministic(buffer: Buffer, mime: string): ExtractedDocument {
  if (!["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv", "application/csv", "text/plain"].includes(mime))
    throw new Error("deterministic_format_unsupported");
  if (mime.includes("spreadsheet")) {
    const book = XLSX.read(buffer, { type: "buffer", cellText: true });
    return parseRows(XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, raw: false, defval: "" }) as unknown[][]);
  }
  return parseRows(delimited(buffer.toString("utf8")));
}

export type MatchedLine = { code_1c: string | null; article: string | null; name: string; qty_doc: string; qty_po: string | null; qty_received: string | null; price_doc: string | null; unit_cost_po: string | null; status: "ok" | "qty_diff" | "price_diff" | "missing_in_po" | "missing_in_doc" };
export function matchDocumentToOrder(doc: ExtractedDocument, poLines: OrderLine[], receipt?: ReceiptLine[]): { lines: MatchedLine[]; summary: { matched: number; discrepancies: number; total_doc: string; total_po: string }; three_way: boolean } {
  const used = new Set<number>();
  const find = (line: { code_1c?: string | null; article?: string | null; name?: string }, rows: OrderLine[] | ReceiptLine[], exclude = used) => {
    for (const key of ["code_1c", "article", "name"] as const) {
      const value = line[key];
      if (!value) continue;
      const index = rows.findIndex((candidate, index) => !exclude.has(index) && candidate[key] && canon(candidate[key]) === canon(value));
      if (index >= 0) return index;
    }
    return -1;
  };
  const lines: MatchedLine[] = doc.lines.map(line => {
    const index = find(line, poLines);
    if (index < 0) return { code_1c: line.code_1c, article: line.article, name: line.name, qty_doc: line.qty, qty_po: null, qty_received: null, price_doc: line.price, unit_cost_po: null, status: "missing_in_po" };
    used.add(index);
    const po = poLines[index];
    const receivedIndex = receipt ? find(po, receipt, new Set()) : -1;
    const received = receivedIndex >= 0 ? receipt?.[receivedIndex] : undefined;
    const qtyReceived = received ? quantity(received.qty) : null;
    const status = !new Decimal(line.qty).eq(po.qty) || (receipt !== undefined && (qtyReceived === null || !new Decimal(line.qty).eq(qtyReceived))) ? "qty_diff"
      : line.price && po.unit_cost && !new Decimal(line.price).eq(po.unit_cost) ? "price_diff" : "ok";
    return { code_1c: po.code_1c, article: line.article || po.article || null, name: line.name, qty_doc: line.qty,
      qty_po: quantity(po.qty), qty_received: qtyReceived, price_doc: line.price, unit_cost_po: po.unit_cost || null, status };
  });
  poLines.forEach((po, index) => { if (!used.has(index)) lines.push({ code_1c: po.code_1c, article: po.article || null, name: po.name, qty_doc: "0", qty_po: quantity(po.qty), qty_received: null, price_doc: null, unit_cost_po: po.unit_cost || null, status: "missing_in_doc" }); });
  return { lines, summary: { matched: lines.filter(x => !["missing_in_po", "missing_in_doc"].includes(x.status)).length, discrepancies: lines.filter(x => x.status !== "ok").length,
    total_doc: formatAmount(doc.lines.reduce((sum, x) => sum.plus(x.amount ?? (x.price ? new Decimal(x.price).times(x.qty) : 0)), new Decimal(0))),
    total_po: formatAmount(poLines.reduce((sum, x) => sum.plus(new Decimal(x.unit_cost || 0).times(x.qty)), new Decimal(0))) }, three_way: receipt !== undefined };
}

export type DraftOrder = { id: string; supplier_name: string; buyer_name?: string | null; contract?: string | null; currency?: string | null; country_origin?: string | null; lines: OrderLine[] };
function suggestHeading(name: string): string | null {
  // Four-digit headings are preliminary, never declaration-ready ten-digit codes.
  if (/(?:узо|автоматическ\S*\s+выключател\S*)/i.test(name)) return "8536";
  if (/кабел[ьи]/i.test(name)) return "8544";
  return null;
}
export function draftsForPackage(route: SupplyRoute, po: DraftOrder, invoice?: ExtractedDocument | null): Record<string, unknown> {
  const label = "Черновик подготовлен агентом — не отправлен";
  if (route === "eaeu") {
    const lines = (invoice?.lines.length ? invoice.lines : po.lines.map(x => ({ name: x.name, unit: x.unit || null, qty: quantity(x.qty), price: x.unit_cost || null, amount: x.unit_cost ? formatAmount(new Decimal(x.unit_cost).times(x.qty)) : null })));
    return { form_328_00: { label, seller: invoice?.supplier || po.supplier_name, buyer: invoice?.buyer || po.buyer_name || null, contract: po.contract || null,
      invoice_number: invoice?.number || null, invoice_date: invoice?.date || null, currency: invoice?.currency || po.currency || null,
      lines: lines.map(x => ({ name: x.name, unit: x.unit, qty: x.qty, value: x.amount, currency: invoice?.currency || po.currency || null,
        vat_12_percent: x.amount ? formatAmount(new Decimal(x.amount).times("0.12")) : null })) } };
  }
  if (route === "import") return { dt_draft: { label, declarant: po.buyer_name || null, sender: invoice?.supplier || po.supplier_name,
    invoice_number: invoice?.number || null, currency: invoice?.currency || po.currency || null,
    lines: (invoice?.lines.length ? invoice.lines : po.lines.map(x => ({ name: x.name, qty: quantity(x.qty), amount: x.unit_cost ? formatAmount(new Decimal(x.unit_cost).times(x.qty)) : null })))
      .map(x => ({ name: x.name, qty: x.qty, tn_ved_eaeu_suggestion: suggestHeading(x.name),
        suggestion_level: "товарная позиция (4 знака); для ДТ нужен полный код", needs_review: true,
        invoice_value: x.amount, country_origin: po.country_origin || null })) } };
  return {};
}
