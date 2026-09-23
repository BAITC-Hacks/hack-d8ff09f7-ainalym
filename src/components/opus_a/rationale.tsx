"use client";
import Link from "next/link";
import { ArrowRight, FileText, PackageX, Truck, Warehouse } from "lucide-react";
import { day, monthLong, monthShort, qty } from "./format";
import { Pill } from "./ui";

export type Components = { base_rate?: number; season?: Record<string, number>; season_source?: string; growth?: number; horizon_days?: number; forecast_qty?: number; monthly_forecast?: Record<string, number>; stockout_months?: string[]; stockout_uplift?: number; outliers_excluded?: { doc_no: string; ym: string; qty: number; threshold: number }[]; outlier_threshold?: number; safety?: number; on_hand?: number; on_hand_as_of?: string; in_transit?: number; in_transit_sources?: { po_ref: string; qty: string; expected_at: string | null; source_file?: string }[]; net_need?: number; raw_need?: number; moq?: number; days_of_cover?: number; source_months?: number; sales_lines?: number; stock_month?: string; stock_stale?: boolean; median_month_qty?: number; p95_doc_qty?: number };

/** The numbers that made the quantity, read from the engine's persisted components (no recomputation in the UI). */
export function Receipt({ c, recommended, adjusted }: { c: Components; recommended: number; adjusted?: number | null }) {
  return <dl className="oa-receipt">
    <dt>Прогноз на {c.horizon_days ?? "—"} дн</dt><dd>{qty(c.forecast_qty, 1)}</dd>
    <dt>+ Страховой запас</dt><dd>{qty(c.safety, 1)}</dd>
    <dt>− Остаток{c.on_hand_as_of ? ` на ${day(c.on_hand_as_of)}` : ""}</dt><dd>{qty(c.on_hand)}</dd>
    <dt>− В пути</dt><dd>{qty(c.in_transit)}</dd>
    <dt className="total">= Потребность</dt><dd className="total">{qty(c.net_need, 1)}</dd>
    <dt>Кратность {c.moq ?? 1} → к заказу</dt><dd><strong>{qty(recommended)} шт</strong></dd>
    {adjusted !== null && adjusted !== undefined && adjusted !== recommended ? <><dt>Ваша корректировка</dt><dd><strong>{qty(adjusted)} шт</strong></dd></> : null}
  </dl>;
}
export function Forecast({ c }: { c: Components }) {
  const months = Object.keys(c.monthly_forecast ?? {});
  const active = new Set(months.map(m => Number(m.slice(5, 7))));
  const season = c.season ?? {};
  const max = Math.max(1, ...Object.values(season));
  return <div>
    <h4>Как считали прогноз</h4>
    <div style={{ font: "400 14px/20px var(--oa-font)" }}>Регулярный спрос <strong>{qty(c.base_rate, 1)} шт/мес</strong> · рост ×{qty(c.growth, 2)} (предел ±50 %)</div>
    <div className="oa-season" aria-label="Сезонный индекс по месяцам">{Array.from({ length: 12 }, (_, i) => <i key={i} data-on={active.has(i + 1)} style={{ height: `${Math.max(4, (season[String(i + 1)] ?? 0) / max * 100)}%` }} title={`${monthShort(`2000-${String(i + 1).padStart(2, "0")}`)}: ×${qty(season[String(i + 1)] ?? 0, 2)}`} />)}</div>
    <div className="oa-season-l" aria-hidden>{"ЯФМАМИИАСОНД".split("").map((l, i) => <span key={i}>{l}</span>)}</div>
    <p className="muted" style={{ font: "var(--oa-meta)", margin: "6px 0 8px" }}>{c.season_source === "sku" ? "Сезонность самого товара (12+ месяцев продаж)" : "Сезонность поставщика по выручке — у товара мало истории"}; тёмным — месяцы горизонта.</p>
    <div className="oa-chips">{months.map(m => <Pill key={m} tone="plum">{monthShort(m)} {qty(c.monthly_forecast![m], 1)}</Pill>)}</div>
  </div>;
}
export function Exclusions({ c, code, max = 3 }: { c: Components; code?: string; max?: number }) {
  const out = c.outliers_excluded ?? []; const so = c.stockout_months ?? [];
  return <div>
    <h4>Что исключено и восполнено</h4>
    <ul className="oa-facts">
      {out.length ? out.slice(0, max).map(o => <li key={`${o.doc_no}-${o.ym}`}><PackageX size={15} aria-hidden /><span>Разовый документ <strong>№ {o.doc_no}</strong> · {monthLong(o.ym)} · {qty(o.qty)} шт при пороге {qty(o.threshold, 1)} — <Pill tone="warn">исключён</Pill></span></li>)
        : <li><PackageX size={15} aria-hidden /><span>Разовых документов нет (порог {qty(c.outlier_threshold, 1)} шт)</span></li>}
      {out.length > max ? <li><PackageX size={15} aria-hidden /><span>и ещё {qty(out.length - max)} разовых документов — всего исключено {qty(out.reduce((s, o) => s + o.qty, 0))} шт</span></li> : null}
      <li><Warehouse size={15} aria-hidden /><span>{so.length ? <>Месяцы без остатка: <strong>{so.map(monthLong).join(", ")}</strong> — спрос восстановлен по соседним месяцам (+{qty(c.stockout_uplift, 1)} шт)</> : "Месяцев без остатка нет — восполнять нечего"}</span></li>
      <li><FileText size={15} aria-hidden /><span>Прочитано: {qty(c.sales_lines)} строк продаж за {qty(c.source_months)} мес · остаток на {day(c.on_hand_as_of)}{c.stock_stale ? " — устарел" : ""}</span></li>
      {(c.in_transit_sources ?? []).map((t, i) => <li key={i}><Truck size={15} aria-hidden /><span>В пути {qty(t.qty)} шт · {t.po_ref}{t.expected_at ? ` · ожидается ${day(t.expected_at)}` : ""}</span></li>)}
    </ul>
    {code ? <Link className="oa-link" style={{ display: "inline-flex", gap: 6, alignItems: "center", marginTop: 12, font: "500 14px/20px var(--oa-font)" }} href={`/opus_a/skus/${encodeURIComponent(code)}`}>Карточка товара<ArrowRight size={14} aria-hidden /></Link> : null}
  </div>;
}
