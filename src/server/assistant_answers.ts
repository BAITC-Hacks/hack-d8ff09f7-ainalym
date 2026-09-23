import { db } from "../db/client";
import { moneyView } from "../domain/cashflow";
import { orderById } from "../domain/orders";
import { queueView } from "../domain/views";
import type { AssistantContext } from "../components/assistant/context";

/** Data-backed answers for the assistant, built from saved recommendations and orders. No AI key needed. */
export const CANNOT_ANSWER = "Не могу ответить по этим данным. Попробуйте открыть карточку товара.";
export type AnswerItem = { id: string; title: string; href?: string; meta?: string };
export type Answer = { ok: boolean; kind: AnswerKind; reply_ru: string; items?: AnswerItem[] };
export type AnswerKind = "pay_week" | "why_order" | "urgent" | "why_qty" | "what_if_transit" | "needs_me" | "changed" | "unknown";
export type Ask = { text: string; context: AssistantContext; base?: string; org_id: string; asOf?: Date };

type Rec = { id: string; run_id: string; code_1c: string; supplier_id: string; qty_recommended: number; qty_adjusted: number | null; urgency: string | null; rationale_ru: string | null; components: string | null; proposal_id: string | null };
type SkuRow = { code_1c: string; name: string; unit: string | null; moq: number | null; supplier_id: string };

const SUPPLIER: Record<string, string> = { IEK: "IEK", SE: "Systeme Electric" };
const KIND: Record<string, string> = { prepayment: "предоплата", balance: "остаток при поставке", obligation: "обязательство" };
const URGENCY: Record<string, string> = { critical: "критично", soon: "скоро", normal: "планово", none: "не требуется" };
const nf = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const money = (amount: string | number, currency: string) => `${nf.format(Number(amount))} ${currency === "KZT" ? "₸" : currency}`;
const date = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(d); };
const plural = (n: number, one: string, few: string, many: string) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many; };
const num = (value: unknown): number | null => { if (value === null || value === undefined || value === "") return null; const n = Number(value); return Number.isFinite(n) ? n : null; };
const clip = (text: string, max = 140) => text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

export function detectKind(text: string, context: AssistantContext): AnswerKind {
  const t = text.toLowerCase();
  const { code_1c, po_id } = context.entity;
  if (code_1c && /в пути|транзит/.test(t) && /(если|изменится|\+\s*\d)/.test(t)) return "what_if_transit";
  if (/заплат|оплат|платеж|платёж/.test(t)) return "pay_week";
  if (code_1c && /почему столько|почему так|сколько заказ|откуда количество|почему заказ/.test(t)) return "why_qty";
  if (po_id && /почему заказ|почему такой|состав заказа|откуда заказ|что в заказе/.test(t)) return "why_order";
  if (/срочно|критич|горит|в первую очередь/.test(t)) return "urgent";
  if (/нужно от меня|от меня|очеред|решени|утверд|проверить/.test(t)) return "needs_me";
  if (/что измен|что нового|изменилось|последние действия/.test(t)) return "changed";
  if (/почему|объясни|обоснов/.test(t)) return code_1c ? "why_qty" : po_id ? "why_order" : "unknown";
  return "unknown";
}

const like = (value: string) => value.replace(/[\\%_]/g, ch => `\\${ch}`);
/** Resolves a typed or spoken SKU reference to a stored code (same order as the voice lane): trim → exact → code + "_" → prefix → article/name. */
export function resolveSkuCode(raw: string): string | undefined {
  const text = (raw ?? "").trim();
  const code = text.replace(/\s+/g, "");
  if (!code || code.length > 80) return undefined;
  const d = db();
  const one = (sql: string, ...args: string[]) => (d.prepare(sql).get(...args) as { code_1c: string } | undefined)?.code_1c;
  return one("SELECT code_1c FROM sku WHERE code_1c = ?", code)
    ?? one("SELECT code_1c FROM sku WHERE code_1c = ?", `${code}_`)
    ?? one("SELECT code_1c FROM sku WHERE code_1c LIKE ? ESCAPE '\\' ORDER BY code_1c LIMIT 1", `${like(code)}%`)
    ?? one("SELECT code_1c FROM sku WHERE article = ? OR article = ? LIMIT 1", code, text)
    ?? (text.length >= 4 ? byNameOrArticle(text) : undefined);
}
/** Case-insensitive Cyrillic-safe match on article or name (SQLite LIKE only folds ASCII). */
function byNameOrArticle(text: string): string | undefined {
  const needle = text.toLowerCase();
  const rows = db().prepare("SELECT code_1c, article, name FROM sku ORDER BY code_1c").all() as { code_1c: string; article: string | null; name: string }[];
  return rows.find(row => (row.article ?? "").toLowerCase().includes(needle) || row.name.toLowerCase().includes(needle))?.code_1c;
}
/** A SKU mentioned in free text: a 7–12 digit code, with or without the trailing underscore («почему 130200122» → 130200122_). */
export function mentionedSku(text: string): string | undefined {
  for (const match of text.matchAll(/(?<!\d)(\d{7,12}_?)(?!\d)/g)) { const hit = resolveSkuCode(match[1]); if (hit) return hit; }
  return undefined;
}

function latestRec(code: string): Rec | undefined {
  return db().prepare("SELECT id, run_id, code_1c, supplier_id, qty_recommended, qty_adjusted, urgency, rationale_ru, components, proposal_id FROM recommendation WHERE code_1c = ? ORDER BY rowid DESC LIMIT 1").get(code) as Rec | undefined;
}
function skuRow(code: string): SkuRow | undefined {
  return db().prepare("SELECT code_1c, name, unit, moq, supplier_id FROM sku WHERE code_1c = ?").get(code) as SkuRow | undefined;
}
function components(rec: Rec): Record<string, unknown> {
  if (!rec.components) return {};
  try { const parsed = JSON.parse(rec.components) as unknown; return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}; } catch { return {}; }
}

function whyQty(code: string, base: string): Answer {
  const sku = skuRow(code);
  if (!sku) return { ok: false, kind: "why_qty", reply_ru: CANNOT_ANSWER };
  const rec = latestRec(code);
  const name = sku.name;
  const unit = sku.unit ?? "шт";
  const card: AnswerItem = { id: "card", title: `Открыть карточку ${code}`, href: `${base}/skus/${encodeURIComponent(code)}` };
  if (!rec) return { ok: true, kind: "why_qty", reply_ru: `Для позиции «${name}» расчёт ещё не сохранён. Запустите расчёт в разделе «Пополнение» — и я объясню количество.`, items: [{ id: "replenishment", title: "Открыть «Пополнение»", href: `${base}/replenishment` }, card] };
  const c = components(rec);
  const qty = rec.qty_adjusted ?? rec.qty_recommended;
  const forecast = num(c.forecast_qty), safety = num(c.safety), onHand = num(c.on_hand), transit = num(c.in_transit), horizon = num(c.horizon_days);
  let reply = `Рекомендация по «${name}»: ${nf.format(qty)} ${unit}${rec.qty_adjusted !== null && rec.qty_adjusted !== undefined ? " (после вашей корректировки)" : ""}.`;
  const parts: string[] = [];
  if (forecast !== null) parts.push(`прогноз продаж${horizon ? ` на ${nf.format(horizon)} дн.` : ""} — ${nf.format(forecast)} ${unit}`);
  if (safety !== null) parts.push(`страховой запас — ${nf.format(safety)}`);
  if (onHand !== null) parts.push(`на складе — ${nf.format(onHand)}`);
  if (transit !== null) parts.push(`уже в пути — ${nf.format(transit)}`);
  if (parts.length) reply += ` Как посчитано: ${parts.join(", ")}. Заказываем разницу между потребностью и тем, что есть и едет.`;
  if (rec.rationale_ru) reply += ` ${rec.rationale_ru.trim()}`;
  const stockouts = Array.isArray(c.stockout_months) ? c.stockout_months.length : 0;
  const outliers = Array.isArray(c.outliers_excluded) ? c.outliers_excluded.length : 0;
  if (stockouts) reply += ` Учтены ${stockouts} ${plural(stockouts, "месяц", "месяца", "месяцев")} с дефицитом — спрос в них был выше продаж.`;
  if (outliers) reply += ` Разовые крупные отгрузки исключены: ${outliers}.`;
  if (rec.urgency && URGENCY[rec.urgency]) reply += ` Срочность: ${URGENCY[rec.urgency]}.`;
  const items: AnswerItem[] = [card];
  if (rec.proposal_id) items.push({ id: "adjust", title: "Скорректировать количество", href: `${base}/replenishment`, meta: "в очереди решений" });
  return { ok: true, kind: "why_qty", reply_ru: reply, items };
}

function whatIfTransit(code: string, text: string, base: string): Answer {
  const sku = skuRow(code);
  const rec = sku ? latestRec(code) : undefined;
  if (!sku || !rec) return whyQty(code, base);
  const delta = Math.max(1, Number.parseInt((text.match(/\+?\s*(\d[\d\s]*)/)?.[1] ?? "100").replace(/\s+/g, ""), 10) || 100);
  const c = components(rec);
  const unit = sku.unit ?? "шт";
  const current = rec.qty_adjusted ?? rec.qty_recommended;
  const next = Math.max(0, current - delta);
  const forecast = num(c.forecast_qty), safety = num(c.safety);
  let reply = `Если в пути станет на ${nf.format(delta)} ${unit} больше, заказ по «${sku.name}» снизится с ${nf.format(current)} до ${nf.format(next)} ${unit}${next === 0 ? " — пока партия едет, заказывать не нужно" : ""}.`;
  reply += ` Потребность не меняется${forecast !== null ? ` (${nf.format(forecast + (safety ?? 0))} ${unit} с запасом)` : ""} — меняется только то, что уже едет.`;
  const moq = num(sku.moq) ?? 0;
  if (moq > 1 && next > 0) { const rounded = Math.ceil(next / moq) * moq; if (rounded !== next) reply += ` С учётом минимальной партии ${nf.format(moq)} ${unit} — ${nf.format(rounded)} ${unit}.`; }
  const items: AnswerItem[] = [{ id: "card", title: `Открыть карточку ${code}`, href: `${base}/skus/${encodeURIComponent(code)}` }];
  if (rec.proposal_id) items.push({ id: "adjust", title: "Скорректировать количество", href: `${base}/replenishment`, meta: "в очереди решений" });
  return { ok: true, kind: "what_if_transit", reply_ru: reply, items };
}

function whyOrder(poId: string, base: string): Answer {
  const order = orderById(poId);
  if (!order) return { ok: true, kind: "why_order", reply_ru: "Не нахожу этот заказ. Откройте страницу поставщика ещё раз — черновик появляется после утверждения предложения в очереди решений.", items: [{ id: "queue", title: "Открыть «Пополнение»", href: `${base}/replenishment` }] };
  const lines = (order.lines as unknown as { code_1c: string; qty: number; name?: string | null; rationale_ru?: string | null }[]).slice().sort((a, b) => Number(b.qty) - Number(a.qty));
  const supplier = SUPPLIER[String(order.supplier_id)] ?? String(order.supplier_id);
  const totalQty = lines.reduce((sum, line) => sum + Number(line.qty || 0), 0);
  if (!lines.length) return { ok: true, kind: "why_order", reply_ru: `Заказ ${supplier} пока без позиций.`, items: [] };
  const reply = `Заказ ${supplier}: ${lines.length} ${plural(lines.length, "позиция", "позиции", "позиций")}, ${nf.format(totalQty)} шт. Количество по каждой позиции — прогноз продаж на срок поставки плюс страховой запас, минус остаток и то, что уже едет. Ниже — самые крупные строки и почему они в заказе.`;
  const items: AnswerItem[] = lines.slice(0, 5).map(line => ({
    id: line.code_1c, title: line.name ? `${line.name}` : line.code_1c, href: `${base}/skus/${encodeURIComponent(line.code_1c)}`,
    meta: `${nf.format(Number(line.qty))} шт${line.rationale_ru ? ` — ${clip(line.rationale_ru.trim())}` : ""}`,
  }));
  return { ok: true, kind: "why_order", reply_ru: reply, items };
}

function urgent(context: AssistantContext, base: string): Answer {
  const { po_id, supplier_id } = context.entity;
  let codes: Set<string> | null = null;
  let supplier = supplier_id;
  if (po_id) {
    const order = orderById(po_id);
    codes = new Set(order ? (order.lines as unknown as { code_1c: string }[]).map(line => String(line.code_1c)) : []);
    if (order && !supplier) supplier = String(order.supplier_id);
  }
  const rows = db().prepare(`SELECT r.code_1c, r.qty_recommended, r.qty_adjusted, r.urgency, s.name, s.unit FROM recommendation r JOIN sku s ON s.code_1c = r.code_1c
    WHERE r.rowid IN (SELECT MAX(rowid) FROM recommendation GROUP BY code_1c) AND r.urgency IN ('critical','soon')${supplier ? " AND r.supplier_id = ?" : ""}
    ORDER BY CASE r.urgency WHEN 'critical' THEN 0 ELSE 1 END, r.qty_recommended DESC LIMIT 200`).all(...(supplier ? [supplier] : [])) as { code_1c: string; qty_recommended: number; qty_adjusted: number | null; urgency: string; name: string; unit: string | null }[];
  const hits = rows.filter(row => !codes || codes.has(row.code_1c));
  const scope = po_id ? "В этом заказе" : supplier ? `У поставщика ${SUPPLIER[supplier] ?? supplier}` : "По складу";
  if (!hits.length) return { ok: true, kind: "urgent", reply_ru: `${scope} срочных позиций сейчас нет — всё в плановом режиме.`, items: [] };
  const critical = hits.filter(row => row.urgency === "critical").length;
  const soon = hits.length - critical;
  const reply = `${scope} срочно: ${critical ? `${critical} ${plural(critical, "критичная", "критичные", "критичных")}` : ""}${critical && soon ? ", " : ""}${soon ? `${soon} — скоро` : ""}. Сначала закройте критичные: по ним запас закончится раньше, чем придёт поставка.`;
  const items: AnswerItem[] = hits.slice(0, 8).map(row => ({
    id: row.code_1c, title: row.name, href: `${base}/skus/${encodeURIComponent(row.code_1c)}`,
    meta: `${nf.format(row.qty_adjusted ?? row.qty_recommended)} ${row.unit ?? "шт"} · ${URGENCY[row.urgency] ?? row.urgency}`,
  }));
  return { ok: true, kind: "urgent", reply_ru: reply, items };
}

async function payWeek(orgId: string, base: string, asOf: Date): Promise<Answer> {
  const view = await moneyView(orgId, asOf);
  const all = [...view.next_60d.out].sort((a, b) => a.at.localeCompare(b.at));
  const start = asOf.getTime() - 86_400_000;
  const end = asOf.getTime() + 7 * 86_400_000;
  const week = all.filter(o => { const t = Date.parse(o.at); return Number.isFinite(t) && t >= start && t <= end; });
  if (!week.length) {
    const next = all.find(o => Date.parse(o.at) > end);
    const reply = next
      ? `На этой неделе платежей поставщикам нет. Ближайший — ${date(next.at)}: ${money(next.amount, next.currency)} по заказу ${next.po_id} (${KIND[next.kind] ?? next.kind}).`
      : "На этой неделе платежей поставщикам нет: утверждённых заказов с датой оплаты пока нет.";
    return { ok: true, kind: "pay_week", reply_ru: reply, items: next ? [{ id: next.po_id, title: `Заказ ${next.po_id}`, href: `${base}/orders`, meta: `${date(next.at)} · ${money(next.amount, next.currency)}` }] : [] };
  }
  const totals = new Map<string, number>();
  for (const o of week) totals.set(o.currency, (totals.get(o.currency) ?? 0) + Number(o.amount));
  const total = [...totals.entries()].map(([currency, amount]) => money(amount, currency)).join(" + ");
  const reply = `На этой неделе к оплате ${total} — ${week.length} ${plural(week.length, "платёж", "платежа", "платежей")}. Предоплата списывается при утверждении заказа, остаток — к дате поставки.`;
  const items: AnswerItem[] = week.slice(0, 8).map((o, index) => ({
    id: `${o.po_id}-${index}`, title: `${date(o.at)} · ${money(o.amount, o.currency)}`, href: `${base}/orders`,
    meta: `${KIND[o.kind] ?? o.kind} · заказ ${o.po_id}`,
  }));
  return { ok: true, kind: "pay_week", reply_ru: reply, items };
}

async function needsMe(orgId: string, base: string): Promise<Answer> {
  const queue = await queueView(orgId);
  const rows = (queue.items as unknown as { id: unknown; title?: unknown; money_at_stake?: { amount?: string; currency?: string } | null }[]).filter(item => item && typeof item === "object");
  if (!rows.length) return { ok: true, kind: "needs_me", reply_ru: "Сейчас нет решений, требующих вашего участия.", items: [] };
  const reply = `Ждут вашего решения: ${rows.length} ${plural(rows.length, "предложение", "предложения", "предложений")}. Откройте «Пополнение», чтобы утвердить или скорректировать.`;
  const items: AnswerItem[] = rows.slice(0, 8).map(item => ({
    id: String(item.id), title: typeof item.title === "string" ? item.title : "Предложение", href: `${base}/replenishment`,
    meta: item.money_at_stake?.amount ? money(item.money_at_stake.amount, item.money_at_stake.currency ?? "KZT") : undefined,
  }));
  return { ok: true, kind: "needs_me", reply_ru: reply, items };
}

function changed(orgId: string): Answer {
  const rows = db().prepare("SELECT summary_ru FROM agent_action WHERE org_id = ? ORDER BY rowid DESC LIMIT 8").all(orgId) as { summary_ru: string }[];
  if (!rows.length) return { ok: true, kind: "changed", reply_ru: "Подтверждённых изменений пока нет.", items: [] };
  return { ok: true, kind: "changed", reply_ru: `Последние изменения: ${rows.map(row => row.summary_ru).join("; ")}.`, items: [] };
}

export async function answerInContext(ask: Ask): Promise<Answer> {
  const base = ask.base && /^\/[a-z0-9_-]*$/i.test(ask.base) ? ask.base.replace(/\/$/, "") : "/v2";
  const mentioned = mentionedSku(ask.text);
  let context: AssistantContext = mentioned ? { ...ask.context, entity: { ...ask.context.entity, code_1c: mentioned } } : ask.context;
  let kind = detectKind(ask.text, context);
  if (kind === "unknown" && mentioned) kind = "why_qty";
  if (kind === "unknown") {
    // «почему <название или артикул>» — look the position up by article or name.
    const rest = ask.text.replace(/^(почему|объясни|расскажи про|что с|покажи|сколько заказать)\s+/i, "").trim();
    const byName = rest !== ask.text.trim() && rest.length >= 4 ? resolveSkuCode(rest) : undefined;
    if (byName) { context = { ...context, entity: { ...context.entity, code_1c: byName } }; kind = "why_qty"; }
  }
  const { code_1c, po_id } = context.entity;
  switch (kind) {
    case "why_qty": return whyQty(code_1c!, base);
    case "what_if_transit": return whatIfTransit(code_1c!, ask.text, base);
    case "why_order": return whyOrder(po_id!, base);
    case "urgent": return urgent(context, base);
    case "pay_week": return payWeek(ask.org_id, base, ask.asOf ?? new Date());
    case "needs_me": return needsMe(ask.org_id, base);
    case "changed": return changed(ask.org_id);
    default: return { ok: false, kind: "unknown", reply_ru: CANNOT_ANSWER };
  }
}
