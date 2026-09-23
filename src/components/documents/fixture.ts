/* Local fixture with the intake API shapes — the same synthetic IEK invoice the API ships as fixtures/documents/iek_invoice_demo.xlsx.
   Used only when the document API does not answer; every screen labels it as «пример». */
import type { IntakeDocument, MatchedLine, OrderPackage, PackageItem, SupplyRoute } from "./types";

export const FIXTURE_NAME = "iek_invoice_demo.xlsx";
export const FIXTURE_DOC_ID = "DOC-demo-iek-0923";
export const FIXTURE_PO_ID = "PO-IEK-DEMO-0923";

const rows: [string, string, string, string, string, string | null, string | null][] = [
  ["010300001_", "MAD10-2-010-C-030", "УЗО АД 12 (2ф) 10А IEK (5/40)", "60", "100", "1000.00", "1000.00"],
  ["010300002_", "MAD10-2-016-C-030", "УЗО АД 12 (2ф) 16А IEK (5/40)", "20", "20", "1237.50", "1237.50"],
  ["010300003_", "MAD10-2-025-C-030", "УЗО АД 12 (2ф) 25А IEK (5/40)", "20", "20", "1250.00", "1200.00"],
  ["010300004_", "MAD10-2-032-C-030", "УЗО АД 12 (2ф) 32А IEK (5/40)", "20", "20", "1375.00", "1375.00"],
  ["010300005_", "MAD10-2-040-C-030", "УЗО АД 12 (2ф) 40А IEK (4/32)", "20", "20", "1500.00", "1500.00"],
  ["010300006_", "MAD10-2-050-C-030", "УЗО АД 12 (2ф) 50А IEK (4/32)", "20", "20", "1625.00", "1625.00"],
  ["010300007_", "MAD10-2-063-C-030", "УЗО АД 12 (2ф) 63А IEK (4/32)", "20", "20", "1750.00", "1750.00"],
  ["010300008_", "MAD10-4-016-C-030", "УЗО АД 14 (4ф) 16А IEK (3/24)", "20", "20", "1875.00", "1875.00"],
  ["010300009_", "MAD10-4-025-C-030", "УЗО АД 14 (4ф) 25А IEK (3/24)", "20", "20", "2000.00", "2000.00"],
  ["010300010_", "MAD10-4-032-C-030", "УЗО АД 14 (4ф) 32А IEK (3/24)", "20", "20", "2125.00", "2125.00"],
];
const money = (n: number) => n.toFixed(2);
const lines: MatchedLine[] = rows.map(([code_1c, article, name, qty_doc, qty_po, price_doc, unit_cost_po]) => ({
  code_1c, article, name, qty_doc, qty_po, qty_received: null, price_doc, unit_cost_po,
  status: qty_doc !== qty_po ? "qty_diff" : price_doc !== unit_cost_po ? "price_diff" : "ok",
}));
const totalDoc = rows.reduce((s, r) => s + Number(r[3]) * Number(r[5]), 0);
const totalPo = rows.reduce((s, r) => s + Number(r[4]) * Number(r[6]), 0);

export const fixtureDocument: IntakeDocument = {
  id: FIXTURE_DOC_ID, po_id: FIXTURE_PO_ID, supplier_id: "IEK", kind: "invoice", source: "fixture",
  file_name: FIXTURE_NAME, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", sha256: "8c1f3a2e9d4b7c6a5f0e1d2c3b4a5968776655443322110099aabbccddeeff00", size: 9_318,
  extracted: {
    number: "IEK-DEMO-0923", date: "23.09.2026", supplier: "IEK", buyer: "ТОО «Электрокомплект»", currency: "KZT",
    lines: rows.map(([code_1c, article, name, qty, , price]) => ({ code_1c, article, name, unit: "шт", qty, price, amount: money(Number(qty) * Number(price)) })),
  },
  extraction_mode: "deterministic",
  match: { lines, summary: { matched: lines.length, discrepancies: lines.filter(l => l.status !== "ok").length, total_doc: money(totalDoc), total_po: money(totalPo) }, three_way: false },
  state: "discrepancy", created_at: "2026-09-23T08:40:00.000Z", version: 1,
};

type Item = Omit<PackageItem, "status" | "document_id">;
const item = (key: string, title_ru: string, stage: Item["stage"], source: Item["source"], required = true): Item => ({ key, title_ru, stage, required, source });
const receipt = item("warehouse_receipt", "Акт приёмки на склад", "receipt", "warehouse");
const PACKAGES: Record<SupplyRoute, Item[]> = {
  domestic: [item("payment_invoice", "Счёт на оплату", "invoice", "supplier"), item("contract", "Договор", "contract", "supplier"), item("esf", "ЭСФ (электронный счёт-фактура)", "invoice", "state_system"), item("delivery_note", "Накладная на отпуск запасов", "transport", "supplier"), receipt],
  eaeu: [item("contract", "Договор", "contract", "supplier"), item("invoice", "Счёт / инвойс", "invoice", "supplier"), item("delivery_note", "Товарная накладная (УПД / ТОРГ-12)", "transport", "supplier"), item("transport", "CMR / ТТН", "transport", "carrier"),
    item("form_328_00", "Заявление о ввозе и уплате косвенных налогов (форма 328.00)", "import", "agent_draft"), item("form_320_00", "НДС при импорте 12 % (форма 320.00)", "import", "state_system"), item("statistical_form", "Статистическая форма учёта перемещения товаров", "import", "state_system"), item("conformity", "Сертификат / декларация соответствия ЕАЭС", "import", "supplier"), receipt],
  import: [item("contract", "Контракт", "contract", "supplier"), item("invoice", "Инвойс", "invoice", "supplier"), item("packing_list", "Packing list", "transport", "supplier"), item("transport", "Транспортный документ (CMR / ж/д накладная / коносамент)", "transport", "carrier"),
    item("origin_certificate", "Сертификат происхождения", "import", "supplier"), item("tn_ved", "Коды ТН ВЭД ЕАЭС по строкам — предложение агента, проверка декларанта", "import", "agent_draft"), item("dt_draft", "Декларация на товары (ДТ) через ИС «Кеден»", "import", "agent_draft"),
    item("customs_payments", "Таможенные платежи (пошлина, НДС 12 %, сбор)", "import", "state_system"), item("conformity", "Сертификаты соответствия", "import", "supplier"), receipt],
};
const label = "Черновик подготовлен агентом — не отправлен";
const draftLines = fixtureDocument.extracted.lines.map(l => ({ name: l.name, unit: l.unit, qty: l.qty, value: l.amount, currency: "KZT", vat_12_percent: money(Number(l.amount) * 0.12) }));
function drafts(route: SupplyRoute): Record<string, unknown> {
  if (route === "eaeu") return { form_328_00: { label, seller: "IEK", buyer: "ТОО «Электрокомплект»", contract: null, invoice_number: "IEK-DEMO-0923", invoice_date: "23.09.2026", currency: "KZT", lines: draftLines } };
  if (route === "import") return { dt_draft: { label, declarant: "ТОО «Электрокомплект»", sender: "IEK", invoice_number: "IEK-DEMO-0923", currency: "KZT",
    lines: fixtureDocument.extracted.lines.map(l => ({ name: l.name, qty: l.qty, tn_ved_eaeu_suggestion: "8536", suggestion_level: "товарная позиция (4 знака); для ДТ нужен полный код", needs_review: true, invoice_value: l.amount, country_origin: null })) } };
  return {};
}
/** Package for the fixture order: the invoice is present with a discrepancy, agent drafts exist for the route, the rest is missing. */
export function fixturePackage(route: SupplyRoute = "eaeu", withInvoice = true): OrderPackage {
  const d = drafts(route);
  const items: PackageItem[] = PACKAGES[route].map(x => {
    const invoice = withInvoice && (x.key === "invoice" || x.key === "payment_invoice");
    const status: PackageItem["status"] = invoice ? "discrepancy" : (x.key in d || (x.key === "tn_ved" && "dt_draft" in d)) ? "draft" : "missing";
    return { ...x, status, ...(invoice ? { document_id: FIXTURE_DOC_ID } : {}) };
  });
  const stage_rail = (["contract", "invoice", "transport", "import", "receipt"] as const).map(stage => {
    const rel = items.filter(x => x.stage === stage);
    return { stage, state: rel.some(x => x.status === "discrepancy") ? "discrepancy" as const : rel.every(x => x.status === "present") ? "present" as const : rel.some(x => x.status === "draft") ? "draft" as const : "missing" as const };
  });
  return { route, route_note_ru: "Маршрут задан по умолчанию, уточните у менеджера", items, drafts: d, stage_rail };
}
