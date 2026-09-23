"use client";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Database, FileSpreadsheet, Package, Sigma, Truck } from "lucide-react";
import { useApi } from "@/components/shell/api";
import type { TruthAxes } from "@/components/labels";
import { clock, day, money, monthLong, qty } from "./format";
import { ErrorState, Pill, Skel, State, Truth, UrgencyPill } from "./ui";
import { Exclusions, Forecast, Receipt, type Components } from "./rationale";
import { SalesChart, type SeriesPoint } from "./SalesChart";

type Sku = { code_1c: string; supplier_id: string; supplier_name?: string; article: string | null; name: string; unit: string | null; category: string | null; unit_cost: string | null; moq: number; first_sale_ym: string | null; months_with_sales: number | null; on_hand_qty: string | null; on_hand_as_of: string | null; currency?: string };
type Rec = { id: string; qty_recommended: number; qty_adjusted: number | null; urgency: string; rationale_ru: string; components: Components; state: string; version: number };
type Transit = { id: number; po_ref: string; qty: string; expected_at: string | null; source_file: string | null };
type Timeline = { id: string; kind: string; summary_ru: string; autonomy: string; result: string; at: string };
type SkuResp = TruthAxes & { sku: Sku; series: SeriesPoint[]; forecast?: { method_ru?: string | null; horizon_months?: number } | null; recommendation?: Rec | null; in_transit: Transit[]; timeline: Timeline[] };
const REC_STATE: Record<string, string> = { proposed: "предложено агентом", adjusted: "изменено вами", approved: "утверждено", superseded: "заменено новым расчётом" };
const base = (p: string | null) => p ? p.split("/").pop() : "—";

export function SkuCard({ code }: { code: string }) {
  const r = useApi<SkuResp>(`/api/skus/${encodeURIComponent(code)}`);
  const d = r.data; const s = d?.sku; const rec = d?.recommendation; const c = rec?.components ?? {};
  const transit = d?.in_transit ?? [];
  const transitSum = transit.reduce((a, t) => a + Number(t.qty), 0);
  const params = useApi<{ suppliers: { id: string; lead_time_days: number }[] }>("/api/params");
  const lead = params.data?.suppliers.find(p => p.id === s?.supplier_id)?.lead_time_days;
  return <main className="oa-page" id="main">
    <div className="oa-head">
      <div style={{ minWidth: 0 }}>
        <div className="oa-crumb"><Link href={s ? `/opus_a/replenishment?supplier=${s.supplier_id}` : "/opus_a/replenishment"}><ArrowLeft size={16} aria-hidden style={{ verticalAlign: -2 }} /> Пополнение</Link>{s ? <span className="muted">/ {s.supplier_name ?? s.supplier_id}</span> : null}</div>
        {s ? <h1 className="oa-long">{s.name}</h1> : r.loading ? <Skel w={520} h={44} style={{ marginTop: 10 }} /> : <h1>Товар</h1>}
        {s ? <div className="muted" style={{ font: "var(--oa-meta)", marginTop: 8 }}>Код 1С {s.code_1c}{s.article ? ` · артикул ${s.article}` : ""}{s.category ? ` · категория ${s.category}` : ""} · кратность {s.moq}</div> : null}
      </div>
      {s ? <div className="oa-head-actions"><Link className="oa-btn oa-btn-primary" href={`/opus_a/replenishment?supplier=${s.supplier_id}`}>Изменить количество<ArrowRight size={16} aria-hidden /></Link></div> : null}
    </div>
    <Truth axes={d} />
    {r.error && !d ? (r.error.status === 404 ? <State kind="unavailable" title="Товар не найден">Кода {code} нет в данных партнёра. Найдите товар через поиск ⌘K.</State> : <ErrorState error={r.error} onRetry={r.reload} />) : null}

    <section className="oa-strip" aria-label="Запас и прогноз">
      {[
        { l: "Остаток", v: s ? qty(s.on_hand_qty) : undefined, u: "шт", sub: s?.on_hand_as_of ? `на ${day(s.on_hand_as_of)}` : "дата не указана" },
        { l: "В пути", v: d ? qty(transitSum) : undefined, u: "шт", sub: transit.length ? `${transit.length} ${transit.length === 1 ? "поставка" : "поставки"} · ближайшая ${day(transit.map(t => t.expected_at).filter(Boolean).sort()[0] ?? null)}` : "ничего не в пути" },
        { l: "Покрытие запасом", v: rec ? qty(c.days_of_cover, 1) : d ? "—" : undefined, u: "дн", sub: lead ? `срок поставки ${lead} дн` : "срок поставки уточняется", bad: lead !== undefined && (c.days_of_cover ?? 999) < lead },
        { l: `Прогноз на ${c.horizon_days ?? "—"} дн`, v: rec ? qty(c.forecast_qty, 1) : d ? "—" : undefined, u: "шт", sub: rec ? `спрос ${qty(c.base_rate, 1)} шт/мес` : "нет расчёта" },
      ].map(m => <div className="oa-metric" key={m.l}>
        <div className="oa-metric-label">{m.l}</div>
        {m.v === undefined ? <><Skel w="60%" h={34} /><Skel w="80%" h={14} /></> : <><div className="oa-metric-value" style={m.bad ? { color: "var(--oa-bad-fg)" } : undefined}>{m.v}<small>{m.u}</small></div><div className="oa-metric-sub">{m.sub}</div></>}
      </div>)}
    </section>

    <div className="oa-cols">
      <div style={{ display: "grid", gap: 28, minWidth: 0 }}>
        <section style={{ display: "grid", gap: 14 }} aria-labelledby="oa-sales">
          <div className="oa-section-head"><h2 className="oa-h2" id="oa-sales">Продажи и прогноз <small>24 месяца, Алматы</small></h2>
            <div className="oa-legend"><span><i style={{ background: "#6f84c0" }} />продажи</span><span><i style={{ background: "repeating-linear-gradient(45deg,#f1e5c8 0 3px,#b07a12 3px 4px)" }} />разовый документ — исключён</span><span><i style={{ background: "#efe2d6", boxShadow: "inset 0 -3px 0 #c2432a" }} />нет остатка</span><span><i style={{ background: "transparent", borderTop: "2px dashed #5b3b58", height: 0, width: 16 }} />прогноз</span></div>
          </div>
          <div className="oa-card" style={{ padding: "16px 16px 6px" }}>
            {d ? (d.series.length ? <SalesChart series={d.series} forecast={c.monthly_forecast ?? {}} excluded={c.outliers_excluded ?? []} stockoutMonths={c.stockout_months ?? []} /> : <State kind="empty" title="Продаж нет">У товара нет продаж за период данных.</State>) : <Skel h={280} />}
          </div>
        </section>
        {rec ? <section className="oa-card" style={{ padding: 20, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 28 }} aria-label="Прогноз и исключения">
          <Forecast c={c} /><Exclusions c={c} max={4} />
        </section> : null}
        {d && d.timeline.length ? <section className="oa-rail-block" aria-labelledby="oa-hist"><h2 id="oa-hist">История агента</h2>
          <ol className="oa-feed">{d.timeline.slice(0, 8).map(t => <li key={t.id}><span className="dot" data-tone={t.result === "failed" ? "bad" : t.autonomy === "auto" ? undefined : "warn"} aria-hidden /><div><div className="t">{t.summary_ru}</div><div className="m">{t.autonomy === "auto" ? "сам" : "ждёт вас"} · Агенты · данные партнёра</div></div><time dateTime={t.at}>{clock(t.at)}</time></li>)}</ol>
        </section> : null}
      </div>

      <aside className="oa-rightrail" aria-label="Рекомендация, поставки, источники">
        <section className="oa-card" style={{ padding: 20, display: "grid", gap: 14 }} aria-labelledby="oa-rec">
          <div className="oa-section-head"><h2 id="oa-rec" style={{ font: "500 19px/24px var(--oa-font)", margin: 0 }}>Рекомендация</h2>{rec ? <UrgencyPill urgency={rec.urgency} /> : null}</div>
          {!d && r.loading ? <Skel h={120} /> : null}
          {d && !rec ? <State kind="empty" title="В последнем расчёте заказ не нужен">Запаса хватает на срок поставки, или товар не попал в расчёт.</State> : null}
          {rec ? <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}><span className="oa-bigqty">{qty(rec.qty_adjusted ?? rec.qty_recommended)}</span><span className="muted">шт к заказу</span></div>
            <div className="oa-chips"><Pill>{REC_STATE[rec.state] ?? rec.state}</Pill><Pill>v{rec.version}</Pill>{s?.unit_cost ? <Pill tone="ok">{money({ amount: s.unit_cost, currency: s.currency ?? "KZT" }, true)} за шт</Pill> : <Pill tone="warn">себестоимость не задана</Pill>}</div>
            <Receipt c={c} recommended={rec.qty_recommended} adjusted={rec.qty_adjusted} />
          </> : null}
        </section>
        <section className="oa-rail-block" aria-labelledby="oa-transit">
          <h2 id="oa-transit">В пути</h2>
          {d && !transit.length ? <State kind="empty" title="Ничего не в пути">Открытых поставок по этому товару нет.</State> : null}
          <div>{transit.map(t => <div className="oa-po" key={t.id}><b><Truck size={14} aria-hidden style={{ verticalAlign: -2, marginRight: 6 }} />{qty(t.qty)} шт · ожидается {day(t.expected_at)}</b><span>{t.po_ref}</span><span>из файла «{base(t.source_file)}»</span></div>)}</div>
        </section>
        <section className="oa-rail-block" aria-labelledby="oa-src">
          <h2 id="oa-src">Источники</h2>
          {s ? <ul className="oa-facts">
            <li><Database size={15} aria-hidden /><span>Продажи: {qty(c.sales_lines)} строк документов за {qty(c.source_months)} мес{s.first_sale_ym ? `, с ${monthLong(s.first_sale_ym)}` : ""}</span></li>
            <li><Package size={15} aria-hidden /><span>Остаток: снимок {c.stock_month ? monthLong(c.stock_month) : "—"}, на {day(s.on_hand_as_of)}{c.stock_stale ? " — устарел" : ""}</span></li>
            <li><FileSpreadsheet size={15} aria-hidden /><span>В пути: {transit.length ? [...new Set(transit.map(t => base(t.source_file)))].join(", ") : "в файле поставок строк нет"}</span></li>
            <li><Sigma size={15} aria-hidden /><span>{d?.forecast?.method_ru ?? "Метод прогноза не указан"}</span></li>
            <li><FileSpreadsheet size={15} aria-hidden /><span>Себестоимость: {s.unit_cost ? `${money({ amount: s.unit_cost, currency: s.currency ?? "KZT" }, true)} («СС реал»)` : "не задана в файлах партнёра"}</span></li>
          </ul> : <Skel h={120} />}
        </section>
      </aside>
    </div>
  </main>;
}
