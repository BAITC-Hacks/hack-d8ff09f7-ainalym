"use client";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Bot, FileSpreadsheet, Truck } from "lucide-react";
import { useApi } from "@/components/shell/api";
import { OneOffPanel, ReceiptList, SeasonPanel, StockoutPanel } from "./Rationale";
import { Pill, Skel, StateBlock, Truth, UrgencyPill, btnClass } from "./ui";
import { ago, day, int, plural, qty, toNum, ymLong } from "./format";
import { SkuChart } from "./SkuChart";
import type { SkuResponse } from "./types";
import s from "./sku.module.css";

const base = (path?: string | null) => (path ?? "").split("/").pop() || "—";
const REC_STATE: Record<string, string> = { proposed: "В заказе поставщику — ждёт вашего решения", adjusted: "Количество изменено вручную", approved: "Утверждено", stale: "Устарело — есть новый расчёт" };

function Loading() {
  return <div className={s.page} aria-busy="true" aria-label="Загружаю карточку товара">
    <div className={s.head}><Skel w={110} h={16} /><div className={s.titleSkel}><Skel w="72%" h={46} /></div><Skel w={380} h={16} /></div>
    <div className={s.kpis}>{Array.from({ length: 5 }, (_, i) => <div key={i} className={s.kpi}><Skel w={110} h={13} /><Skel w={90} h={30} /><Skel w={120} h={12} /></div>)}</div>
    <div className={s.body}><div className={s.mainCol}><div className={s.chartCard}><Skel h={24} w={220} /><div className={s.chartSkel}><Skel h={300} /></div></div></div><aside className={s.rail}><Skel h={220} /><Skel h={140} /></aside></div>
  </div>;
}

export function SkuCard({ code }: { code: string }) {
  const { data, error, loading, reload } = useApi<SkuResponse>(`/api/skus/${encodeURIComponent(code)}`);
  if (!data && loading) return <Loading />;
  if (!data) {
    if (error?.status === 404) return <div className={s.page}><Link href="/opus_b/replenishment" className={s.crumb}><ArrowLeft size={15} aria-hidden />Пополнение</Link><h1 className={s.title}>Товар не найден</h1><StateBlock kind="empty" title={`Кода ${code} нет в данных партнёра`} detail="Проверьте код 1С или найдите товар через поиск ⌘K." /></div>;
    return <div className={s.page}><Link href="/opus_b/replenishment" className={s.crumb}><ArrowLeft size={15} aria-hidden />Пополнение</Link><h1 className={s.title}>Карточка товара</h1><StateBlock kind="unavailable" title="Карточка недоступна" detail={error?.message ?? "Сервис не ответил."} onAction={reload} /></div>;
  }
  const { sku, series, forecast, in_transit: transit, timeline } = data;
  const rec = data.recommendation ?? null;
  const c = rec?.components ?? null;
  const recQty = rec ? rec.qty_adjusted ?? rec.qty_recommended : null;
  const onHand = toNum(sku.on_hand_qty) ?? c?.on_hand ?? null;
  const asOf = sku.on_hand_as_of ?? c?.on_hand_as_of ?? null;
  const transitQty = transit.reduce((sum, t) => sum + (toNum(t.qty) ?? 0), 0);
  const nextEta = transit.map(t => t.expected_at).filter((v): v is string => Boolean(v)).sort()[0];
  const cover = c?.days_of_cover;
  const horizon = c?.horizon_days;
  const coverShare = cover !== undefined && horizon ? Math.max(0, Math.min(1, cover / horizon)) : 0;
  const first = series[0]?.ym, last = series.at(-1)?.ym;
  const files = Array.from(new Set(transit.map(t => base(t.source_file)).filter(f => f !== "—")));
  return <div className={s.page}>
    <header className={s.head}>
      <div className={s.headTop}>
        <Link href="/opus_b/replenishment" className={s.crumb}><ArrowLeft size={15} aria-hidden />Пополнение</Link>
        <Link href="/opus_b/replenishment" className={btnClass("primary")}>Изменить в пополнении</Link>
      </div>
      <h1 className={s.title} title={sku.name}>{sku.name}</h1>
      <div className={s.metaRow}>
        <span className={s.meta}>{[sku.code_1c, sku.article, sku.supplier_name ?? sku.supplier_id, sku.unit, `кратность ${sku.moq}`].filter(Boolean).join(" · ")}</span>
        {rec && <UrgencyPill urgency={rec.urgency} />}
      </div>
      <Truth axes={data} />
    </header>
    {error && <StateBlock kind="unavailable" title="Обновления недоступны — показываю последнее" detail={error.message} onAction={reload} />}

    <dl className={s.kpis}>
      <div className={s.kpi}><dt>Рекомендуем заказать</dt><dd><span className={s.kpiAccent}>{recQty === null ? "0" : int(recQty)}</span><span className={s.kpiUnit}>шт</span></dd>
        <small>{rec ? rec.qty_adjusted !== null ? `агент предлагал ${int(rec.qty_recommended)}` : `кратность ${c?.moq ?? sku.moq}` : "заказ не нужен"}</small></div>
      <div className={s.kpi}><dt>Запас, дней</dt><dd className={cover !== undefined && cover < 0 ? s.kpiBad : undefined}>{cover === undefined ? "—" : cover < 0 ? "дефицит" : <>{qty(cover)}<span className={s.kpiUnit}>дн</span></>}</dd>
        <small><span className={s.meter} aria-hidden><span style={{ width: `${coverShare * 100}%` }} className={cover !== undefined && cover < 0 ? s.meterBad : undefined} /></span>{horizon ? `из горизонта ${horizon} дн` : "горизонт не задан"}</small></div>
      <div className={s.kpi}><dt>Прогноз на {horizon ?? "—"} дн</dt><dd>{qty(c?.forecast_qty)}<span className={s.kpiUnit}>шт</span></dd><small>≈ {qty(c?.base_rate)} шт/мес регулярно</small></div>
      <div className={s.kpi}><dt>Остаток</dt><dd className={onHand !== null && onHand < 0 ? s.kpiBad : undefined}>{qty(onHand)}<span className={s.kpiUnit}>шт</span></dd><small>{asOf ? `на ${day(asOf)}` : "дата не указана"}{onHand !== null && onHand < 0 ? " · отгружено сверх остатка" : ""}</small></div>
      <div className={s.kpi}><dt>В пути</dt><dd>{int(transitQty)}<span className={s.kpiUnit}>шт</span></dd><small>{nextEta ? `ближайшая ${day(nextEta)}` : "открытых поставок нет"}</small></div>
    </dl>

    <div className={s.body}>
      <div className={s.mainCol}>
        <section className={s.chartCard} aria-labelledby="ob-chart-h">
          <div className={s.sectionHead}><h2 id="ob-chart-h">Продажи и прогноз</h2><span>24 месяца истории · 6 месяцев прогноза</span></div>
          <SkuChart series={series} components={c} forecast={forecast} />
        </section>
        {c && <div className={s.panels}>
          <OneOffPanel list={c.outliers_excluded ?? []} threshold={c.outlier_threshold} />
          <StockoutPanel months={c.stockout_months ?? []} uplift={c.stockout_uplift} />
          <div className={s.span2}><SeasonPanel c={c} /></div>
        </div>}
      </div>

      <aside className={s.rail} aria-label="Рекомендация и источники">
        <section className={s.railSec} aria-labelledby="ob-rec-h">
          <div className={s.railHead}><h2 id="ob-rec-h">Рекомендация</h2>{rec && <UrgencyPill urgency={rec.urgency} />}</div>
          {rec && c ? <>
            <p className={s.recQty}><span>{int(recQty)}</span> шт</p>
            <p className={s.recState}>{REC_STATE[rec.state] ?? `Состояние: ${rec.state}`}</p>
            <ReceiptList c={c} recommended={rec.qty_recommended} />
            <Link className={s.railLink} href="/opus_b/replenishment">Открыть строку в пополнении <ArrowUpRight size={14} aria-hidden /></Link>
          </> : <StateBlock kind="empty" title="Рекомендации нет — заказывать не нужно" detail="Запаса хватает на горизонт заказа." />}
        </section>

        <section className={s.railSec} aria-labelledby="ob-src-h">
          <div className={s.railHead}><h2 id="ob-src-h">Источники</h2><span className={s.railMeta}>что прочитано</span></div>
          <dl className={s.sources}>
            <div><dt>Продажи</dt><dd>{first && last ? `${ymLong(first)} — ${ymLong(last)}` : "нет истории"}<small>{c?.sales_lines !== undefined ? `${int(c.sales_lines)} ${plural(c.sales_lines, "строка", "строки", "строк")} документов` : `${sku.months_with_sales ?? 0} мес с продажами`}</small></dd></div>
            <div><dt>Остаток</dt><dd>{asOf ? `на ${day(asOf)}` : "дата не указана"}{c?.stock_stale && <Pill tone="warn">устарел</Pill>}<small>{c?.stock_month ? `месячный срез ${ymLong(c.stock_month)}` : "срез не указан"}</small></dd></div>
            <div><dt>В пути</dt><dd>{files.length ? files.join(", ") : "открытых поставок нет"}<small>{transit.length} {plural(transit.length, "строка", "строки", "строк")}</small></dd></div>
            <div><dt>Сезонность</dt><dd>{c?.season_source === "sku" ? "по истории товара" : c?.season_source ? "по выручке поставщика" : "—"}<small>{forecast?.method_ru ?? "метод не указан"}</small></dd></div>
            <div><dt>Разовые</dt><dd>порог {qty(c?.outlier_threshold)} шт<small>медиана мес. {qty(c?.median_month_qty)} · p95 документа {qty(c?.p95_doc_qty)}</small></dd></div>
          </dl>
        </section>

        <section className={s.railSec} aria-labelledby="ob-transit-h">
          <div className={s.railHead}><h2 id="ob-transit-h">В пути</h2><span className={s.railMeta}>{int(transitQty)} шт</span></div>
          {transit.length === 0 ? <p className={s.quiet}>Открытых поставок нет.</p> :
            <ul className={s.list}>{transit.map(t => <li key={t.id} className={s.transit}>
              <span className={s.icon} aria-hidden><Truck size={15} /></span>
              <span className={s.two}><b>{t.po_ref}</b><small><FileSpreadsheet size={12} aria-hidden /> {base(t.source_file)}</small></span>
              <span className={s.num}>{qty(t.qty)} шт<small>ETA {day(t.expected_at)}</small></span>
            </li>)}</ul>}
        </section>

        <section className={s.railSec} aria-labelledby="ob-log-h">
          <div className={s.railHead}><h2 id="ob-log-h">Журнал агента</h2><span className={s.railMeta}>Агенты · данные партнёра</span></div>
          {timeline.length === 0 ? <p className={s.quiet}>Агент ещё не работал с этим товаром.</p> :
            <ul className={s.list}>{timeline.slice(0, 6).map(t => <li key={t.id} className={s.logRow}>
              <span className={s.icon} aria-hidden><Bot size={15} /></span>
              <span className={s.two}><b>{t.summary_ru}</b><small>{ago(t.at)}</small></span>
              {t.autonomy === "escalated" ? <Pill tone="warn">вам</Pill> : t.autonomy === "auto" ? <Pill tone="ok">сам</Pill> : <Pill>{t.autonomy ?? "—"}</Pill>}
            </li>)}</ul>}
        </section>
      </aside>
    </div>
  </div>;
}
