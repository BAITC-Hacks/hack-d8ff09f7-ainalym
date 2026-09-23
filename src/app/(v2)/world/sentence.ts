// Plain-Russian copy for /world «События»: one sentence per event a business owner understands. Pure, no IO.
export type Who = "ИИ-Помощник" | "менеджер" | "поставщик" | "1С-файл";
export type FeedEvent = { id: string; kind: string; text?: string | null; at?: string | null; emitted_at?: string | null; processed_at?: string | null; state: string; actor_id?: string | null; code_1c?: string | null; po_id?: string | null; run_id?: string | null; payload?: Record<string, unknown> | null };
export type Sentence = { text: string; who: Who; code: string | null; link: { href: string; label: string } | null };
type P = Record<string, unknown>;

const SUPPLIERS: Record<string, string> = { IEK: "IEK", SE: "Systeme Electric" };
const nf0 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const qty = (v: unknown) => `${nf0.format(Number(v) || 0)} шт`;
export const money = (v: unknown) => `${nf2.format(Number(v) || 0)} ₸`;
export const shortDate = (iso: unknown) => { if (!iso) return null; const d = new Date(String(iso).length === 10 ? `${iso}T00:00:00` : String(iso)); return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }); };
const supplier = (p: P) => { const id = String(p.supplier_id ?? ""); return id ? SUPPLIERS[id] ?? id : null; };
const rows = (p: P): P[] => Array.isArray(p.lines) ? p.lines as P[] : Array.isArray(p.rows) ? p.rows as P[] : Array.isArray(p.stocks) ? p.stocks as P[] : p.line && typeof p.line === "object" ? [p.line as P] : [];
const plural = (n: number, one: string, few: string, many: string) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many; };
export const positions = (n: number) => `${nf0.format(n)} ${plural(n, "позиция", "позиции", "позиций")}`;
const done = (e: FeedEvent) => e.state === "processed" || e.state === "replayed";
const tail = (e: FeedEvent, did: string) => done(e) ? ` — ${did}` : e.state === "failed" ? " — обработать не удалось, нужна проверка" : " — ИИ-Помощник ещё не обработал";

export function describe(e: FeedEvent, name: (code: string) => string | null): Sentence {
  const p = (e.payload ?? {}) as P;
  const list = rows(p);
  const code = e.code_1c || (list.length === 1 ? String(list[0].code_1c ?? "") : "") || null;
  const product = (c: string | null) => c ? (name(c) ?? `товар ${c}`) : "товар";
  const productLink = (c: string | null) => c ? { href: `/skus/${encodeURIComponent(c)}`, label: "Открыть товар" } : null;
  const sup = supplier(p);
  switch (e.kind) {
    case "sales_day": {
      const day = shortDate(p.date) ?? shortDate(e.at);
      const total = list.reduce((s, r) => s + (Number(r.qty) || 0), 0);
      return { who: "1С-файл", code: null, link: { href: "/replenishment", label: "Открыть закупки" },
        text: `Из 1С пришли продажи за ${day ?? "день"}${sup ? ` по ${sup}` : ""}: ${positions(list.length)}, ${qty(total)}${tail(e, "остатки и потребность пересчитаны")}` };
    }
    case "stock_snapshot": {
      const ym = String(p.ym ?? "");
      const m = ym ? new Date(`${ym}-01T00:00:00`).toLocaleDateString("ru-RU", { month: "long", year: "numeric" }) : null;
      return { who: "1С-файл", code: null, link: { href: "/skus", label: "Открыть товары" },
        text: `Из 1С пришли остатки склада${m ? ` на ${m}` : ""}: ${positions(list.length)}${tail(e, "расчёт потребности обновлён")}` };
    }
    case "in_transit_update": {
      const when = list.map(r => shortDate(r.expected_at)).find(Boolean);
      if (list.length === 1 && code) return { who: "1С-файл", code, link: productLink(code),
        text: `Товар в пути по «${product(code)}»: ${qty(list[0].qty ?? list[0].delta)}${when ? `, ожидается ${when}` : ""}${tail(e, "потребность пересчитана")}` };
      return { who: "1С-файл", code: null, link: { href: "/orders", label: "Открыть заказы" },
        text: `Обновился товар в пути${sup ? ` от ${sup}` : ""}: ${positions(list.length)}${when ? `, ожидается ${when}` : ""}${tail(e, "потребность пересчитана")}` };
    }
    case "judge_message": {
      const action = String(p.action ?? p.preset ?? "");
      if (action === "inject_sales_line" || action === "oneoff") {
        const line = (p.line as P | undefined) ?? p;
        return { who: "менеджер", code, link: productLink(code), text: `Разовая продажа ${qty(line.qty)} по «${product(code)}»${tail(e, "исключена из расчёта как нетипичная")}` };
      }
      if (action === "adjust_in_transit" || action === "intransit") return { who: "менеджер", code, link: productLink(code), text: `Товар в пути по «${product(code)}» увеличен на ${qty(p.delta_qty ?? p.delta ?? p.qty)}${tail(e, "потребность пересчитана")}` };
      if (action === "update_unit_cost" || action === "price_update") return { who: "менеджер", code, link: productLink(code), text: `Себестоимость «${product(code)}» изменена${p.from != null ? ` с ${money(p.from)}` : ""} на ${money(p.to ?? p.unit_cost)}${tail(e, "цена учтена в расчёте")}` };
      return { who: "менеджер", code, link: productLink(code), text: `Менеджер попросил: ${String(e.text ?? "").replace(/\s+/g, " ").trim() || "изменить данные"}${tail(e, "выполнено")}` };
    }
    case "price_update": return { who: "1С-файл", code, link: productLink(code), text: `Себестоимость «${product(code)}» теперь ${money(p.unit_cost ?? p.price ?? p.to)}${tail(e, "цена учтена в расчёте")}` };
    case "supplier_reply": {
      const po = String(p.po_id ?? e.po_id ?? "");
      const said = String(e.text ?? p.text ?? "").trim();
      return { who: "поставщик", code: null, link: po ? { href: `/orders/${encodeURIComponent(po)}`, label: "Открыть заказ" } : { href: "/orders", label: "Открыть заказы" },
        text: `Поставщик${sup ? ` ${sup}` : ""} ответил по заказу${said ? `: «${said}»` : ""}${tail(e, "ответ записан в заказ")}` };
    }
    case "order_drafted": return { who: "ИИ-Помощник", code: null, link: { href: "/orders", label: "Открыть заказы" }, text: `ИИ-Помощник подготовил черновик заказа${sup ? ` для ${sup}` : ""} — нужно ваше решение` };
    case "order_approved": return { who: "менеджер", code: null, link: { href: "/orders", label: "Открыть заказы" }, text: `Заказ${sup ? ` ${sup}` : ""} утверждён` };
    case "recommendation_run": return { who: "ИИ-Помощник", code: null, link: { href: "/replenishment", label: "Открыть закупки" }, text: "ИИ-Помощник пересчитал потребность по всем товарам" };
    default: return { who: e.actor_id === "supplier" || (e.actor_id && SUPPLIERS[e.actor_id]) ? "поставщик" : e.actor_id === "agent" || e.actor_id === "system" ? "ИИ-Помощник" : "менеджер", code, link: productLink(code), text: `${String(e.text ?? "").replace(/\s+/g, " ").trim() || "Изменение данных"}${tail(e, "учтено")}` };
  }
}

const ALMATY = "Asia/Almaty";
export const dayKey = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("ru-RU", { timeZone: ALMATY, day: "2-digit", month: "2-digit", year: "numeric" }); };
export function dayLabel(key: string, now = new Date()) {
  if (key === dayKey(now.toISOString())) return "Сегодня";
  if (key === dayKey(new Date(now.getTime() - 86_400_000).toISOString())) return "Вчера";
  return key;
}
export const clock = (iso?: string | null) => { if (!iso) return ""; const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("ru-RU", { timeZone: ALMATY, hour: "2-digit", minute: "2-digit" }); };
