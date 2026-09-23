// Pure mapper: real order/feed/ledger/file states → pipeline rows. No fetching, no dates invented.
export type StepKey = "draft" | "approved" | "letter" | "reply" | "transit" | "received";
export type StepState = "done" | "current" | "pending" | "unknown";
export type Step = { key: StepKey; label: string; state: StepState; note?: string };
export type DocState = "получен" | "не получен" | "не требуется";
export type Doc = { label: string; state: DocState; note?: string };
export type Payout = { kind: string; amount: string; currency: string; at: string };
export type PipelineRow = {
  id: string; kind: "system" | "partner"; synthetic?: boolean; version?: number; supplier_id: string; title: string; header: string;
  lines: number; qty: number; total_cost: string | null; cost_known_lines: number;
  steps: Step[]; stage_label: string;
  arrival: { date: string | null; days: number | null; label: string };
  customs: string | null; plan_eta: string | null;
  reply: { text: string | null; at: string | null };
  letter_at: string | null;
  docs: Doc[]; payouts: Payout[];
  source_file: string | null; file_date: string | null;
};

export type OrderIn = { id: string; supplier_id: string; state: string; version?: number; total_qty?: number; total_cost?: string | null; cost_known_lines?: number; eta?: string | null; export_path?: string | null; lines?: unknown[]; arrival_at?: string | null; arrives_by?: string | null; arrival_by?: string | null };
export type FeedIn = { kind: string; po_id?: string | null; text?: string | null; at?: string | null; emitted_at?: string | null };
export type LedgerIn = { kind: string; po_id?: string | null; at: string; summary_ru?: string | null };
export type MoneyOutIn = { at: string; amount: string; currency: string; po_id: string; kind: string };
export type TransitIn = { po_ref: string; supplier_id: string; expected_at?: string | null; source_file: string | null; file_date?: string | null; lines: number; qty: number };

export const STEP_LABELS: Record<StepKey, string> = { draft: "Черновик", approved: "Утверждён", letter: "Письмо подготовлено", reply: "Ответ поставщика", transit: "В пути", received: "Получен" };
export const CUSTOMS_LINE = "граница/таможня ~2–3 дн (регламент)";
const grouped = (n: number) => new Intl.NumberFormat("ru-RU").format(n).replace(/\s/g, "\u202f");
/** Order numbers are long system identifiers; staff see the short tail, the full number stays in the header block. */
export const shortId = (id: string) => id.replace(/^PO-/, "").slice(0, 8);
const ORDER: StepKey[] = ["draft", "approved", "letter", "reply", "transit", "received"];

/** Only a date written in the partner's own header counts («поступление до dd.mm.yyyy»). */
export function arrivalFromHeader(header: string): string | null {
  const m = /поступлени[ея]\s+до\s+(\d{2})\.(\d{2})\.(\d{4})/i.exec(header);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
export function daysUntil(iso: string | null, now: Date): number | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const target = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / 86_400_000);
}
export const ddmm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
export function arrivalLabel(date: string | null): string { return date ? `поступление до ${ddmm(date)}` : "в пути"; }
export function daysLabel(days: number | null): string | null {
  if (days === null) return null;
  if (days === 0) return "поступление сегодня";
  if (days < 0) return `срок вышел ${-days} дн назад`;
  return `через ${days} дн`;
}
/** Policy line, never a date: RF-origin IEK shipments (system IEK orders ship from RF; partner headers marked «РФ»). */
export function customsLine(supplier_id: string, header: string, kind: "system" | "partner"): string | null {
  if (supplier_id !== "IEK") return null;
  return kind === "system" || /^РФ(\s|$)/.test(header.trim()) ? CUSTOMS_LINE : null;
}

const APPROVED_STATES = new Set(["approved", "exported", "sent", "confirmed", "in_transit", "received"]);
const TRANSIT_STATES = new Set(["in_transit", "shipped"]);

function stageLabel(steps: Step[]): string {
  const current = [...steps].reverse().find(s => s.state === "current") ?? steps[0];
  return current.label;
}

export function mapSystemOrder(o: OrderIn, feed: FeedIn[], ledger: LedgerIn[], money: MoneyOutIn[], now: Date): PipelineRow {
  const approved = APPROVED_STATES.has(o.state);
  const reply = feed.find(r => r.kind === "supplier_reply" && r.po_id === o.id) ?? null;
  // The draft-order and the supplier-letter ledger rows share one kind; the letter row is the one that says «письмо». A reply proves a letter went out.
  const letter = ledger.find(r => r.po_id === o.id && r.kind === "order_drafted" && /письм/i.test(r.summary_ru ?? "")) ?? (reply ? { kind: "order_drafted", po_id: o.id, at: reply.at ?? reply.emitted_at ?? "" } : null);
  const realArrival = [o.arrival_at, o.arrives_by, o.arrival_by].find(v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) ?? null;
  const inTransit = TRANSIT_STATES.has(o.state) || (!!realArrival && o.state !== "received");
  const received = o.state === "received";
  const reached: Record<StepKey, boolean> = { draft: true, approved, letter: !!letter, reply: !!reply, transit: inTransit || received, received };
  const lastDone = [...ORDER].reverse().find(k => reached[k]) ?? "draft";
  const steps: Step[] = ORDER.map(key => ({
    key, label: STEP_LABELS[key],
    state: reached[key] ? (key === lastDone ? "current" : "done") : "pending",
    note: key === "reply" && !reply ? (approved ? "ответа пока нет" : undefined) : key === "transit" && inTransit ? arrivalLabel(realArrival) : undefined,
  }));
  const exported = o.state === "exported" || !!o.export_path;
  const payouts = money.filter(m => m.po_id === o.id).map(m => ({ kind: m.kind, amount: m.amount, currency: m.currency, at: m.at }));
  const prepay = payouts.find(p => /prepayment$/.test(p.kind));
  const docs: Doc[] = [
    { label: "Черновик заказа", state: "получен" },
    { label: "Письмо поставщику (черновик)", state: approved ? (letter ? "получен" : "не получен") : "не требуется", note: approved ? undefined : "после утверждения" },
    { label: "Ответ поставщика", state: approved ? (reply ? "получен" : "не получен") : "не требуется", note: approved && !reply ? "ответа пока нет" : undefined },
    { label: "Экспорт для 1С (файл)", state: exported ? "получен" : approved ? "не получен" : "не требуется", note: exported ? undefined : approved ? "скачайте на странице заказа" : "после утверждения" },
    { label: "Предоплата 30 %", state: approved && prepay ? "не получен" : "не требуется", note: prepay ? `к оплате ${prepay.amount} ${prepay.currency}` : approved ? "себестоимость не задана" : "после утверждения" },
  ];
  const lines = o.lines?.length ?? 0;
  return {
    id: o.id, kind: "system", version: o.version, supplier_id: o.supplier_id, title: `Заказ ${o.supplier_id} · №${shortId(o.id)}`, header: `Заказ ${o.id} поставщику ${o.supplier_id}: ${grouped(lines)} позиций, ${grouped(o.total_qty ?? 0)} шт`,
    lines, qty: o.total_qty ?? 0, total_cost: o.total_cost ?? null, cost_known_lines: o.cost_known_lines ?? 0,
    steps, stage_label: stageLabel(steps),
    arrival: { date: realArrival, days: daysUntil(realArrival, now), label: inTransit ? arrivalLabel(realArrival) : "ещё не отправлен" },
    customs: inTransit ? customsLine(o.supplier_id, "", "system") : null, plan_eta: o.eta ?? null,
    reply: { text: reply?.text ?? null, at: reply?.at ?? reply?.emitted_at ?? null }, letter_at: letter?.at ?? null,
    docs, payouts, source_file: null, file_date: null,
  };
}

const SYNTHETIC_REF = /^(JUDGE|WE|SCRIPT|DEMO)[-_]/i;
export function mapPartnerTransit(t: TransitIn, now: Date): PipelineRow {
  const date = arrivalFromHeader(t.po_ref);
  if (SYNTHETIC_REF.test(t.po_ref) || !t.source_file) return mapDemoTransit(t, date, now);
  const steps: Step[] = ORDER.map(key => {
    if (key === "draft" || key === "approved") return { key, label: STEP_LABELS[key], state: "done", note: "оформлен в 1С" };
    if (key === "letter" || key === "reply") return { key, label: STEP_LABELS[key], state: "unknown", note: "ведётся в 1С" };
    if (key === "transit") return { key, label: STEP_LABELS[key], state: "current", note: arrivalLabel(date) };
    return { key, label: STEP_LABELS[key], state: "pending" };
  });
  return {
    id: `partner:${t.supplier_id}:${t.po_ref}`, kind: "partner", supplier_id: t.supplier_id, title: t.po_ref.replace(/\s*\(.*\)\s*$/, ""), header: t.po_ref,
    lines: t.lines, qty: Math.round(t.qty), total_cost: null, cost_known_lines: 0,
    steps, stage_label: STEP_LABELS.transit,
    arrival: { date, days: daysUntil(date, now), label: arrivalLabel(date) },
    customs: customsLine(t.supplier_id, t.po_ref, "partner"), plan_eta: null,
    reply: { text: null, at: null }, letter_at: null,
    docs: [
      { label: "Отчёт 1С «Товар в пути»", state: "получен", note: t.file_date ? `файл от ${ddmm(t.file_date)}.${t.file_date.slice(0, 4)}` : undefined },
      { label: "Письмо поставщику", state: "не требуется", note: "оформлено в 1С" },
      { label: "Ответ поставщика", state: "не требуется", note: "ведётся в 1С" },
      { label: "Экспорт для 1С (файл)", state: "не требуется", note: "заказ уже в 1С" },
    ],
    payouts: [], source_file: t.source_file, file_date: t.file_date ?? null,
  };
}

function mapDemoTransit(t: TransitIn, date: string | null, now: Date): PipelineRow {
  const title = `Демо-событие: +${grouped(Math.round(t.qty))} шт в пути по ${t.supplier_id}`;
  const steps: Step[] = ORDER.map(key => key === "transit" ? { key, label: STEP_LABELS[key], state: "current", note: arrivalLabel(date) } : key === "received" ? { key, label: STEP_LABELS[key], state: "pending" } : { key, label: STEP_LABELS[key], state: "unknown", note: "событие ленты" });
  return {
    id: `partner:${t.supplier_id}:${t.po_ref}`, kind: "partner", synthetic: true, supplier_id: t.supplier_id, title, header: `${title} — добавлено из ленты событий`,
    lines: t.lines, qty: Math.round(t.qty), total_cost: null, cost_known_lines: 0,
    steps, stage_label: STEP_LABELS.transit,
    arrival: { date, days: daysUntil(date, now), label: arrivalLabel(date) },
    customs: null, plan_eta: null,
    reply: { text: null, at: null }, letter_at: null,
    docs: [{ label: "Событие ленты «товар в пути»", state: "получен" }, { label: "Экспорт для 1С (файл)", state: "не требуется", note: "демо-событие" }],
    payouts: [], source_file: null, file_date: t.file_date ?? null,
  };
}

export function buildPipeline(input: { orders: OrderIn[]; feed: FeedIn[]; ledger: LedgerIn[]; money: MoneyOutIn[]; transit: TransitIn[] }, now = new Date()): PipelineRow[] {
  const system = input.orders.map(o => mapSystemOrder(o, input.feed, input.ledger, input.money, now));
  const partner = input.transit.map(t => mapPartnerTransit(t, now)).sort((a, b) => (a.arrival.date ?? "9999").localeCompare(b.arrival.date ?? "9999"));
  return [...system, ...partner];
}
