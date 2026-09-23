"use client";
import type { Components, OneOff } from "./types";
import { day, MONTH_LETTERS, plural, qty, ymLong } from "./format";
import s from "./rationale.module.css";

type Step = { op?: string; label: string; value: string; unit?: string; meta?: string; negative?: boolean; final?: boolean };
/** The arithmetic that produced the quantity, in the engine's own numbers (components), never re-derived. */
export function steps(c: Components, recommended: number): Step[] {
  const horizon = c.horizon_days ?? 0;
  const growth = c.growth ?? 1;
  const transitRows = c.transit_rows ?? c.in_transit_sources?.length ?? 0;
  return [
    { label: "Регулярный спрос", value: qty(c.base_rate), unit: "шт/мес", meta: "без разовых документов" },
    { op: "×", label: "Сезон · рост", value: `×${qty(growth)}`, meta: c.season_source === "sku" ? "сезонность товара" : "сезонность поставщика" },
    { op: "=", label: `Прогноз на ${horizon} дн`, value: qty(c.forecast_qty), unit: "шт", meta: "срок поставки + период" },
    { op: "+", label: "Страховой запас", value: qty(c.safety), unit: "шт", meta: "сервис 90 %" },
    { op: "−", label: "Остаток", value: qty(c.on_hand), unit: "шт", meta: c.on_hand_as_of ? `на ${day(c.on_hand_as_of)}` : "дата не указана", negative: (c.on_hand ?? 0) < 0 },
    { op: "−", label: "В пути", value: qty(c.in_transit), unit: "шт", meta: `${transitRows} ${plural(transitRows, "поставка", "поставки", "поставок")}` },
    { op: "=", label: "Потребность", value: qty(c.raw_need ?? c.net_need), unit: "шт" },
    { op: "→", label: `Кратность ${c.moq ?? 1}`, value: qty(recommended), unit: "шт", meta: "к заказу", final: true },
  ];
}
export function Tape({ c, recommended }: { c: Components; recommended: number }) {
  return <div className={s.tape} role="list" aria-label="Как получено количество">
    {steps(c, recommended).map(step => <div role="listitem" key={step.label} className={`${s.cell} ${step.negative ? s.negative : ""} ${step.final ? s.final : ""}`}>
      {step.op && <span className={s.op} aria-hidden>{step.op}</span>}
      <span className={s.label}>{step.label}</span>
      <span className={s.value}>{step.value}{step.unit && <span className={s.unit}>{step.unit}</span>}</span>
      {step.meta && <span className={s.meta}>{step.meta}</span>}
    </div>)}
  </div>;
}
export function ReceiptList({ c, recommended }: { c: Components; recommended: number }) {
  const all = steps(c, recommended);
  return <ol className={s.receipt} aria-label="Как получено количество">
    {all.map(step => <li key={step.label} className={`${s.rline} ${step.final ? s.rtotal : ""} ${step.negative ? s.rneg : ""}`}>
      <span className={s.op} aria-hidden>{step.op ?? ""}</span>
      <span className={s.rlabel}>{step.label}{step.meta && <small>{step.meta}</small>}</span>
      <span className={s.rvalue}>{step.value}{step.unit ? ` ${step.unit}` : ""}</span>
    </li>)}
  </ol>;
}
export function horizonMonths(c: Components) { return new Set(Object.keys(c.monthly_forecast ?? {}).map(k => Number(k.split("-")[1]))); }
export function SeasonPanel({ c }: { c: Components }) {
  const season = c.season ?? {};
  const values = Array.from({ length: 12 }, (_, i) => Number(season[String(i + 1)] ?? 0));
  const max = Math.max(...values, 0.01);
  const on = horizonMonths(c);
  return <section className={s.panel} aria-label="Сезонность">
    <h4 className={s.panelTitle}>Сезонность <span>{c.season_source === "sku" ? "по товару" : "по поставщику"} · рост ×{qty(c.growth)}</span></h4>
    <div className={s.season} aria-hidden>{values.map((v, i) => <span key={i} className={`${s.sbar} ${on.has(i + 1) ? s.sbarOn : ""}`} style={{ height: `${Math.max(4, (v / max) * 100)}%` }} />)}</div>
    <div className={s.sletters} aria-hidden>{MONTH_LETTERS.map((m, i) => <span key={i} className={on.has(i + 1) ? s.on : undefined}>{m}</span>)}</div>
    <p className={s.note}>Выделены месяцы горизонта заказа. Индексы: {values.map((v, i) => on.has(i + 1) ? `${MONTH_LETTERS[i]} ${qty(v)}` : null).filter(Boolean).join(" · ") || "—"}</p>
  </section>;
}
export function OneOffPanel({ list, threshold }: { list: OneOff[]; threshold?: number }) {
  return <section className={s.panel} aria-label="Исключённые разовые документы">
    <h4 className={s.panelTitle}>Исключены разовые <span>порог {qty(threshold)} шт</span></h4>
    {list.length === 0 ? <p className={s.none}>Разовых документов нет — весь спрос регулярный.</p> :
      <ul className={s.docs}>{list.map((d, i) => <li key={`${d.doc_no}-${i}`} className={s.doc}><span>Док. {d.doc_no ?? "без номера"}</span><span className={s.docQty}>{qty(d.qty)} шт</span><small>{ymLong(d.ym)} · больше порога {qty(d.threshold)} — не входит в прогноз</small></li>)}</ul>}
  </section>;
}
export function StockoutPanel({ months, uplift }: { months: string[]; uplift?: number }) {
  return <section className={s.panel} aria-label="Компенсированный дефицит">
    <h4 className={s.panelTitle}>Дефицит компенсирован <span>{months.length} {plural(months.length, "месяц", "месяца", "месяцев")}</span></h4>
    {months.length === 0 ? <p className={s.none}>Месяцев без остатка не было — продажи не занижены.</p> : <>
      <div className={s.months}>{months.map(m => <span key={m} className={s.month}>{ymLong(m)}</span>)}</div>
      <p className={s.note}>Продажи в эти месяцы были ограничены нулевым остатком; спрос оценён по соседним месяцам{uplift ? ` (+${qty(uplift)} шт к истории)` : ""}.</p>
    </>}
  </section>;
}
export function SourcesLine({ c }: { c: Components }) {
  const files = Array.from(new Set((c.in_transit_sources ?? []).map(t => (t.source_file ?? "").split("/").pop()).filter(Boolean)));
  return <ul className={s.sources} aria-label="Что прочитано">
    <li>Продажи: <b>{c.source_months ?? "—"} мес · {qty(c.sales_lines)} строк</b></li>
    <li className={c.stock_stale ? s.staleSrc : undefined}>Остаток: <b>{c.stock_month ?? "—"}{c.on_hand_as_of ? ` · на ${day(c.on_hand_as_of)}` : ""}</b>{c.stock_stale ? " · устарел" : ""}</li>
    <li>В пути: <b>{c.transit_rows ?? 0} {plural(c.transit_rows ?? 0, "строка", "строки", "строк")}</b>{files.length ? ` · ${files.join(", ")}` : ""}</li>
    <li>Медиана мес.: <b>{qty(c.median_month_qty)} шт</b></li>
  </ul>;
}
