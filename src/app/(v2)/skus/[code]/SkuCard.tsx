"use client";
import { useMemo, useRef, useState } from "react";
import { ApiError, apiRequest, useApi, useApiSync } from "@/components/shell";
import { Bars, type Month } from "@/components/v2/Bars";
import { Btn, Card, Empty, Kpis, Loading, PageHead, Pill, Row, Rows, Section, StaleBanner, Truth, Unavailable, URGENCY, fmtDate, fmtMoney, fmtNum, fmtQty, fmtYm, useRowKeys } from "@/components/v2/ui";
import styles from "./sku.module.css";

type Series = { ym: string; qty_file: string | null; qty_lines: string | null; qty_regular: string | null; stockout: number; stock: string | null; stock_known: boolean; outliers: unknown[] };
type Outlier = { doc_no: string; ym: string; qty: number; threshold: number };
type Components = { source_months?: number; sales_lines?: number; stock_month?: string; stock_stale?: boolean; transit_rows?: number; base_rate?: number; season_source?: string; growth?: number; horizon_days?: number; forecast_qty?: number; monthly_forecast?: Record<string, number>; stockout_months?: string[]; stockout_uplift?: number; outliers_excluded?: Outlier[]; median_month_qty?: number; p95_doc_qty?: number; outlier_threshold?: number; safety?: number; on_hand?: number; on_hand_as_of?: string; in_transit?: number; in_transit_sources?: { po_ref: string; qty: string; expected_at: string | null; source_file?: string }[] };
type Sku = { code_1c: string; supplier_id: string; article: string | null; name: string; unit: string | null; category: string | null; unit_cost: string | null; moq: number; first_sale_ym: string | null; months_with_sales: number | null; median_month_qty: string | null; p95_doc_qty: string | null; on_hand_qty: string | null; on_hand_as_of: string | null; supplier_name?: string; currency?: string; version: number };
type Rec = { id: string; run_id: string; qty_recommended: number; qty_adjusted: number | null; on_hand: string; in_transit: string; urgency: string; rationale_ru: string; components: Components; state?: string; version: number };
type Forecast = { id: string; horizon_months: number; base_rate: string; growth: string; stockout_uplift: string; safety: string; method_ru?: string | null };
type Transit = { id: number; po_ref: string; qty: string; expected_at: string | null; source_file: string | null };
type Action = { id: string; kind: string; summary_ru: string; rationale_ru?: string | null; autonomy: string; result: string; at: string };
type Ekt = { url?: string | null; price?: string | number | null; currency?: string | null; stock_total?: number | string | null; stock_by_warehouse?: Record<string, number | string> | { warehouse: string; qty: number | string }[] | null; availability?: string | null; image_url?: string | null; as_of?: string | null; source?: "ekt_api_live" | "ekt_snapshot" | string | null };
type SkuResponse = { ok: true; ai: string; sku: Sku & { image_url?: string | null }; series: Series[]; forecast?: Forecast | null; recommendation?: Rec | null; in_transit: Transit[]; timeline: Action[]; image_url?: string | null; ekt?: Ekt | null; state_version: number };

const REC_STATE: Record<string, string> = { draft: "черновик", needs_review: "ждёт вас", proposed: "ждёт вас", approved: "утверждено", adjusted: "скорректировано", stale: "устарело — есть новая версия", rejected: "отклонено", delivered: "передано", delivery_failed: "ошибка передачи" };
export function SkuCard({ code }: { code: string }) {
  const { data, error, loading, reload } = useApi<SkuResponse>(`/api/skus/${encodeURIComponent(code)}`);
  const rail = useRef<HTMLDivElement>(null);
  useRowKeys(rail);
  if (loading && !data) return <><PageHead crumbs={[{ href: "/replenishment", label: "Пополнение" }, { label: code }]} title={<span className={styles.ghost}>Загружаю…</span>} /><Loading label="Загружаю карточку позиции…" /></>;
  if (error && !data) return <><PageHead crumbs={[{ href: "/replenishment", label: "Пополнение" }, { label: code }]} title={error.status === 404 ? "Позиция не найдена" : "Карточка недоступна"} />
    <Unavailable title={error.status === 404 ? `Код 1С «${code}» отсутствует в данных партнёра` : "Не удалось получить данные позиции"} detail={error.status === 404 ? "Проверьте код: девять цифр и подчёркивание, например 130300027_." : `${error.message} (${error.code})`} retry={reload} /></>;
  if (!data) return null;
  return <SkuBody data={data} reload={reload} rail={rail} stale={!!error} />;
}

function SkuBody({ data, reload, rail, stale }: { data: SkuResponse; reload: () => void; rail: React.RefObject<HTMLDivElement | null>; stale: boolean }) {
  const { sku, series, forecast, recommendation: rec, in_transit, timeline } = data;
  const unit = sku.unit ?? "шт";
  const comp = rec?.components ?? {};
  const outliers = comp.outliers_excluded ?? [];
  const months = useMemo<Month[]>(() => {
    const last24 = series.slice(-24);
    const byYm = new Map<string, Outlier[]>();
    for (const o of outliers) byYm.set(o.ym, [...(byYm.get(o.ym) ?? []), o]);
    const actual: Month[] = last24.map(s => {
      const ex = byYm.get(s.ym) ?? []; const total = Number(s.qty_file ?? 0);
      return { ym: s.ym, total, excluded: Math.min(total, ex.reduce((a, o) => a + o.qty, 0)), excludedDocs: ex.map(o => o.doc_no), stockout: s.stockout === 1, stock: s.stock === null ? null : Number(s.stock), stockKnown: s.stock_known };
    });
    const lastYm = actual[actual.length - 1]?.ym ?? "";
    const fc = Object.entries(comp.monthly_forecast ?? {}).filter(([ym]) => ym > lastYm).map(([ym, v]) => ({ ym, total: v, excluded: 0, excludedDocs: [], stockout: false, stock: null, stockKnown: false, forecast: true }));
    return [...actual, ...fc];
  }, [series, outliers, comp.monthly_forecast]);
  const stockoutMonths = series.filter(s => s.stockout === 1).map(s => s.ym);
  const lastYm = series[series.length - 1]?.ym;
  const urgency = rec ? URGENCY[rec.urgency] ?? URGENCY.none : null;
  const qty = rec ? rec.qty_adjusted ?? rec.qty_recommended : null;
  const need = comp.forecast_qty !== undefined && comp.safety !== undefined ? comp.forecast_qty + comp.safety - Number(rec?.on_hand ?? 0) - Number(rec?.in_transit ?? 0) : null;
  return <>
    {stale && <StaleBanner>Обновление не удалось — показываю последние известные данные.</StaleBanner>}
    <PageHead crumbs={[{ href: "/replenishment", label: "Пополнение" }, { label: sku.supplier_name ?? sku.supplier_id }, { label: sku.code_1c }]}
      title={<span className={styles.titleRow}>{(data.image_url ?? sku.image_url) ? <img className={styles.productImage} src={(data.image_url ?? sku.image_url) as string} alt="" width={56} height={56} loading="lazy" /> : null}<span>{sku.name}</span></span>}
      badges={<>{urgency && <Pill tone={urgency.tone}>{urgency.label}</Pill>}<Pill>{sku.supplier_name ?? sku.supplier_id}</Pill></>}
      sub={<>Код 1С {sku.code_1c}{sku.article && <> · артикул {sku.article}</>}{sku.category && <> · категория {sku.category}</>} · кратность {fmtNum(sku.moq)}</>}
      />
    <Kpis items={[
      { label: "Остаток", value: sku.on_hand_qty === null ? "не задан" : fmtQty(sku.on_hand_qty, unit), meta: sku.on_hand_as_of ? `на ${fmtDate(sku.on_hand_as_of)}${comp.stock_stale ? " · устарел" : ""}` : "остатков в файле нет", tone: sku.on_hand_qty === null ? "warn" : undefined },
      { label: "В пути", value: fmtQty(rec?.in_transit ?? in_transit.reduce((a, t) => a + Number(t.qty), 0), unit), meta: in_transit.length ? `${in_transit.length} поставк${in_transit.length === 1 ? "а" : "и"} · ETA ${fmtDate(in_transit[0].expected_at)}` : "открытых поставок нет" },
      { label: comp.horizon_days ? `Прогноз на ${comp.horizon_days} дн` : "Прогноз", value: comp.forecast_qty !== undefined ? fmtQty(Math.round(comp.forecast_qty), unit) : "нет расчёта", meta: forecast ? `${fmtNum(forecast.base_rate, 1)} ${unit}/мес × сезон × рост ${fmtNum(forecast.growth, 2)}` : "запустите расчёт", tone: forecast ? undefined : "warn" },
      { label: "Рекомендация", value: qty !== null ? fmtQty(qty, unit) : "—", meta: rec ? (rec.qty_adjusted !== null ? `скорректировано · было ${fmtNum(rec.qty_recommended)}` : `кратность ${fmtNum(sku.moq)} · ${REC_STATE[rec.state ?? ""] ?? rec.state ?? "черновик"}`) : "нет рекомендации", tone: urgency?.tone === "bad" ? "bad" : undefined },
    ]} />
    <div className={styles.grid}>
      <div className={styles.main}>
        <Section id="sales" title="Продажи, 24 месяца" aside={<><Truth>Данные партнёра · обезличены</Truth><Truth>по {lastYm ? fmtYm(lastYm) : "—"} · склад Алматы</Truth></>}>
          <Card>
            {months.length ? <Bars months={months} unit={unit} ariaLabel={`Продажи ${sku.code_1c} по месяцам, ${months.length} столбцов`} /> : <Empty title="Продаж за период нет" />}
          </Card>
          <div className={styles.chartNotes}>
            <span>Дефицит: {stockoutMonths.length ? stockoutMonths.map(fmtYm).join(", ") : "не было"}</span>
            <span>Исключено разовых документов: {outliers.length}{comp.outlier_threshold ? ` · порог ${fmtNum(comp.outlier_threshold)} ${unit}` : ""}</span>
            {comp.stockout_uplift ? <span>Компенсация дефицита +{fmtNum(comp.stockout_uplift, 1)} {unit}</span> : null}
          </div>
        </Section>
        <Section id="sources" title="Источники и даты" aside={<Truth>каждое число сверху выводится из этих строк</Truth>}>
          <Rows>
            <Row label="Строки продаж (документы)" meta={`с ${sku.first_sale_ym ? fmtYm(sku.first_sale_ym) : "—"} · ${sku.months_with_sales ?? 0} мес с продажами`} value={fmtNum(comp.sales_lines ?? series.reduce((a, s) => a + Number(s.qty_lines ?? 0) > 0 ? 1 : 0, 0))} valueMeta={`по ${lastYm ? fmtYm(lastYm) : "—"}`} />
            <Row label="Остаток на складе (файл остатков)" meta={comp.stock_stale ? "снимок старше текущего месяца" : `месяц ${comp.stock_month ? fmtYm(comp.stock_month) : lastYm ? fmtYm(lastYm) : "—"}`} value={sku.on_hand_qty === null ? "не задан" : fmtQty(sku.on_hand_qty, unit)} valueMeta={sku.on_hand_as_of ? `на ${fmtDate(sku.on_hand_as_of)}` : "нет даты"} />
            <Row label="В пути (файл поставок)" meta={in_transit[0]?.source_file ? basename(in_transit[0].source_file) : "открытых поставок нет"} value={fmtQty(in_transit.reduce((a, t) => a + Number(t.qty), 0), unit)} valueMeta={in_transit.length ? `ETA ${fmtDate(in_transit[0].expected_at)}` : "—"} />
            <Row label="Сезонность" meta={comp.season_source === "sku" ? "собственные месяцы позиции (≥ 12 с продажами)" : comp.season_source === "supplier" ? `выручка поставщика ${sku.supplier_id} по месяцам` : "нет расчёта"} value={forecast ? `×${fmtNum(monthIndex(comp, lastYm), 2)}` : "—"} valueMeta={lastYm ? `индекс ${fmtYm(lastYm)}` : undefined} />
            <Row label="Себестоимость" meta={sku.unit_cost === null ? "в файле поставщика нет — деньги по позиции не считаются" : `${sku.supplier_id} · «СС реал»`} value={sku.unit_cost === null ? "не задана" : fmtMoney(sku.unit_cost, sku.currency)} valueMeta={sku.unit_cost === null ? undefined : `за ${unit}`} />
            <Row label="Политика" meta={`срок поставки + период обзора = ${comp.horizon_days ?? "—"} дн · уровень сервиса 90 % (z = 1,28)`} value={comp.horizon_days ? `${comp.horizon_days} дн` : "—"} valueMeta="editable через /api/params" />
          </Rows>
        </Section>
        {outliers.length > 0 && <Section id="outliers" title="Исключённые разовые документы" count={outliers.length} aside={<Truth>правило: строка &gt; max(20, min(3 × медиана месяца, 5 × p95 документа))</Truth>}>
          <Rows>{outliers.map(o => <Row key={o.doc_no} label={`Документ ${o.doc_no}`} meta={`${fmtYm(o.ym)} · порог ${fmtNum(o.threshold)} ${unit}`} value={`${fmtNum(o.qty)} ${unit}`} valueMeta="исключено из регулярного спроса" />)}</Rows>
        </Section>}
      </div>
      <aside className={styles.rail} ref={rail} aria-label="Рекомендация и поставки">
        <RecommendationCard rec={rec} sku={sku} unit={unit} need={need} comp={comp} reload={reload} />
        {data.ekt && <EktBlock ekt={data.ekt} unit={unit} />}
        <Section id="transit" title="В пути" count={in_transit.length}>
          {in_transit.length === 0 ? <Empty title="Открытых поставок нет">Строк по позиции в файле «в пути» не найдено — потребность считается без транзита.</Empty>
            : <Rows>{in_transit.map(t => <div key={t.id} data-row tabIndex={0} className={styles.transit}>
              <div className={styles.transitTop}><span className={styles.transitRef}>{t.po_ref}</span><span className={styles.transitQty}>{fmtQty(t.qty, unit)}</span></div>
              <div className={styles.transitMeta}><span>ETA {fmtDate(t.expected_at)}</span><span>{t.source_file ? basename(t.source_file) : "источник не указан"}</span></div>
            </div>)}</Rows>}
        </Section>
        <Section id="timeline" title="Действия агента" count={timeline.length}>
          {timeline.length === 0 ? <Empty title="Действий пока нет">Появятся после запуска расчёта или события мира.</Empty>
            : <Rows>{timeline.slice(0, 6).map(a => <div key={a.id} data-row tabIndex={0} className={styles.action}>
              <div className={styles.transitTop}><span>{a.summary_ru}</span><Pill tone={a.autonomy === "auto" ? "neutral" : "warn"}>{a.autonomy === "auto" ? "авто" : "нужны вы"}</Pill></div>
              <div className={styles.transitMeta}><span>{new Date(a.at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span><span>{a.kind} · {a.result}</span></div>
            </div>)}</Rows>}
        </Section>
      </aside>
    </div>
  </>;
}

function RecommendationCard({ rec, sku, unit, need, comp, reload }: { rec: Rec | null | undefined; sku: Sku; unit: string; need: number | null; comp: Components; reload: () => void }) {
  const { refresh } = useApiSync();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "stale" | "missing" | "error"; text: string } | null>(null);
  if (!rec) return <Card tone="alert"><p className={styles.railTitle}>Рекомендации нет</p><p className={styles.railBody}>Расчёт по этой позиции не выполнен: {sku.on_hand_qty === null ? "в файле остатков нет строки — без остатка потребность не считается." : "позиция не вошла в последний запуск или потребность равна нулю."}</p><p className={styles.railBody}>Запустите расчёт (<code>POST /api/calc/run</code>) — карточка обновится сама.</p></Card>;
  const urgency = URGENCY[rec.urgency] ?? URGENCY.none;
  const current = rec.qty_adjusted ?? rec.qty_recommended;
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setStatus(null);
    try {
      await apiRequest(`/api/recommendations/${encodeURIComponent(rec!.id)}/adjust`, { method: "POST", body: JSON.stringify({ qty: Number(qty), reason, version: rec!.version }) });
      setStatus({ kind: "ok", text: `Количество ${fmtNum(qty)} ${unit} сохранено — версия ${rec!.version + 1}.` }); setOpen(false); refresh();
    } catch (failure) {
      const e = failure instanceof ApiError ? failure : new ApiError(500, "unknown", "Не удалось сохранить.");
      if (e.status === 409) { setStatus({ kind: "stale", text: "Данные обновились — рекомендация пересчитана. Проверьте новое количество." }); refresh(); reload(); }
      else if (e.status === 404) setStatus({ kind: "missing", text: "Корректировка недоступна: маршрут /api/recommendations/:id/adjust на сервере не реализован. Количество можно изменить при утверждении заказа поставщику." });
      else setStatus({ kind: "error", text: `${e.message} (${e.code})` });
    } finally { setBusy(false); }
  }
  return <Card className={styles.recCard}>
    <div className={styles.recTop}><Pill tone={urgency.tone}>{urgency.label}</Pill><Truth>Правила без LLM · запуск {rec.run_id.slice(4, 12)}</Truth></div>
    <p className={styles.recQty}>{fmtNum(current)} <span>{unit}</span></p>
    <p className={styles.recSub}>к заказу у {sku.supplier_name ?? sku.supplier_id}{rec.qty_adjusted !== null && <> · агент предлагал {fmtNum(rec.qty_recommended)}</>}</p>
    <dl className={styles.formula}>
      <div><dt>Прогноз на {comp.horizon_days ?? "—"} дн</dt><dd>{fmtNum(comp.forecast_qty, 1)}</dd></div>
      <div><dt>+ страховой запас</dt><dd>{fmtNum(comp.safety, 1)}</dd></div>
      <div><dt>− остаток{comp.on_hand_as_of ? ` (${fmtDate(comp.on_hand_as_of)})` : ""}</dt><dd>{fmtNum(rec.on_hand)}</dd></div>
      <div><dt>− в пути</dt><dd>{fmtNum(rec.in_transit)}</dd></div>
      <div className={styles.formulaTotal}><dt>= потребность</dt><dd>{need === null ? "—" : fmtNum(Math.max(0, need), 1)}</dd></div>
      <div className={styles.formulaTotal}><dt>округление до кратности {fmtNum(sku.moq)}</dt><dd>{fmtNum(rec.qty_recommended)}</dd></div>
    </dl>
    <details className={styles.why}><summary>Почему так</summary><p>{rec.rationale_ru}</p></details>
    {status && <p className={`${styles.status} ${styles[`status_${status.kind}`]}`} role={status.kind === "ok" ? "status" : "alert"}>{status.text}</p>}
    {!open ? <div className={styles.recActions}><Btn variant="primary" onClick={() => { setQty(String(current)); setOpen(true); }}>Скорректировать</Btn><Btn variant="quiet" onClick={() => { void navigator.clipboard?.writeText(rec.rationale_ru); }}>Копировать обоснование</Btn></div>
      : <form className={styles.adjust} onSubmit={submit} onKeyDown={e => { if (e.key === "Escape") setOpen(false); }}>
        <label>Количество, {unit}<input autoFocus inputMode="numeric" pattern="[0-9]*" value={qty} onChange={e => setQty(e.target.value.replace(/\D/g, ""))} required /></label>
        <label>Причина<input value={reason} onChange={e => setReason(e.target.value)} placeholder="например, акция у клиента в ноябре" required /></label>
        <div className={styles.recActions}><Btn variant="black" type="submit" busy={busy} disabled={!qty || !reason.trim()}>Сохранить · версия {rec.version}</Btn><Btn variant="quiet" type="button" onClick={() => setOpen(false)}>Отмена (Esc)</Btn></div>
      </form>}
  </Card>;
}
function EktBlock({ ekt, unit }: { ekt: Ekt; unit: string }) {
  const live = ekt.source === "ekt_api_live";
  const truth = live ? "Каталог ekt.kz · живой API" : `Снимок каталога ekt.kz${ekt.as_of ? ` от ${fmtDate(ekt.as_of)}` : ""}`;
  const byWh: { warehouse: string; qty: number | string }[] = Array.isArray(ekt.stock_by_warehouse) ? ekt.stock_by_warehouse : ekt.stock_by_warehouse ? Object.entries(ekt.stock_by_warehouse).map(([warehouse, qty]) => ({ warehouse, qty })) : [];
  const price = ekt.price === null || ekt.price === undefined || ekt.price === "" ? null : fmtMoney(String(ekt.price), ekt.currency ?? "KZT");
  return <section className={styles.ekt} aria-label="Каталог ekt.kz">
    <div className={styles.ektTop}><span className={styles.ektName}>ekt.kz</span>{ekt.url && <a href={ekt.url} target="_blank" rel="noreferrer">страница товара ↗</a>}</div>
    <dl className={styles.ektRows}>
      <div><dt>Цена</dt><dd>{price ?? "нет"}</dd></div>
      <div><dt>Остаток</dt><dd>{ekt.stock_total === null || ekt.stock_total === undefined ? "нет" : fmtQty(ekt.stock_total, unit)}</dd></div>
      {ekt.availability && <div><dt>Наличие</dt><dd>{ekt.availability}</dd></div>}
    </dl>
    {byWh.length > 0 && <details className={styles.ektWh}><summary>По складам · {byWh.length}</summary><dl className={styles.ektRows}>{byWh.map(w => <div key={w.warehouse}><dt>{w.warehouse}</dt><dd>{fmtQty(w.qty, unit)}</dd></div>)}</dl></details>}
    <Truth>{truth}{ekt.as_of && live ? ` · ${fmtDate(ekt.as_of)}` : ""}</Truth>
  </section>;
}
function basename(path: string) { return path.split("/").pop() ?? path; }
function monthIndex(comp: Components & { season?: Record<string, number> }, ym?: string) { if (!ym || !comp.season) return 1; return comp.season[String(Number(ym.slice(5, 7)))] ?? 1; }
