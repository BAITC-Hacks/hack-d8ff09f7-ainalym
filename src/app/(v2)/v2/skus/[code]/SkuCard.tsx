"use client";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Coins, Database, FileSpreadsheet, Package, Sigma, SlidersHorizontal, Truck } from "lucide-react";
import { ApiError, apiRequest, useApi, useApiSync } from "@/components/shell";
import { Bars, type Month } from "@/components/v2/Bars";
import { Btn, Card, Empty, Loading, PageHead, Pill, Row, Rows, Section, StaleBanner, Truth, Unavailable, URGENCY, fmtDate, fmtMoney, fmtNum, fmtQty, fmtYm, useRowKeys } from "@/components/v2/ui";
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
const RESULT: Record<string, string> = { ok: "выполнено", done: "выполнено", success: "выполнено", failed: "ошибка", error: "ошибка", skipped: "пропущено", pending: "в работе" };
const CRUMB_BACK = { href: "/v2/replenishment", label: "← Пополнение" };

export function SkuCard({ code }: { code: string }) {
  const { data, error, loading, reload } = useApi<SkuResponse>(`/api/skus/${encodeURIComponent(code)}`);
  const rail = useRef<HTMLDivElement>(null);
  useRowKeys(rail);
  if (loading && !data) return <><PageHead crumbs={[CRUMB_BACK, { label: code }]} title={<span className={styles.ghost}>Загружаю…</span>} /><Loading label="Загружаю карточку позиции…" /></>;
  if (error && !data) return <><PageHead crumbs={[CRUMB_BACK, { label: code }]} title={error.status === 404 ? "Позиция не найдена" : "Карточка недоступна"} />
    <Unavailable title={error.status === 404 ? `Код 1С «${code}» отсутствует в данных партнёра` : "Не удалось получить данные позиции"} detail={error.status === 404 ? "Проверьте код: девять цифр и подчёркивание, например 130300027_." : "Попробуйте обновить страницу через минуту — данные подтянутся сами."} retry={reload} /></>;
  if (!data) return null;
  return <SkuBody data={data} reload={reload} rail={rail} stale={!!error} />;
}

function SkuBody({ data, reload, rail, stale }: { data: SkuResponse; reload: () => void; rail: React.RefObject<HTMLDivElement | null>; stale: boolean }) {
  const { sku, series, forecast, recommendation: rec, in_transit, timeline } = data;
  const [open, setOpen] = useState(false);
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
  const transitTotal = in_transit.reduce((a, t) => a + Number(t.qty), 0);
  const image = data.image_url ?? sku.image_url;
  const canAdjust = !!rec && !open;
  const jumpToAdjust = () => { setOpen(true); requestAnimationFrame(() => document.getElementById("rec")?.scrollIntoView({ block: "start", behavior: "smooth" })); };
  return <>
    {stale && <StaleBanner>Обновление не удалось — показываю последний сохранённый снимок.</StaleBanner>}
    <PageHead crumbs={[CRUMB_BACK, { label: sku.supplier_name ?? sku.supplier_id }]}
      title={<span className={styles.titleRow}>{image ? <img className={styles.productImage} src={image} alt="" width={44} height={44} loading="lazy" /> : null}<span>{sku.name}</span></span>}
      sub={<>Код 1С {sku.code_1c}{sku.article && <> · артикул {sku.article}</>}{sku.category && <> · категория {sku.category}</>} · кратность {fmtNum(sku.moq)}</>}
      badges={<>{urgency && <Pill tone={urgency.tone}>{urgency.label}</Pill>}<Pill>{sku.supplier_name ?? sku.supplier_id}</Pill><Pill>Данные партнёра · обезличены</Pill></>}
      actions={canAdjust ? <button type="button" className={styles.headBtn} onClick={jumpToAdjust}>Изменить количество<ArrowRight size={16} aria-hidden /></button> : undefined} />
    <dl className={styles.strip} aria-label="Запас и прогноз">
      <Metric label="Остаток" value={sku.on_hand_qty === null ? "не задан" : fmtNum(sku.on_hand_qty)} unit={sku.on_hand_qty === null ? undefined : unit} tone={sku.on_hand_qty === null ? "warn" : undefined}
        sub={sku.on_hand_as_of ? `на ${fmtDate(sku.on_hand_as_of)}${comp.stock_stale ? " · устарел" : ""}` : "остатков в файле нет"} />
      <Metric label="В пути" value={fmtNum(rec?.in_transit ?? transitTotal)} unit={unit}
        sub={in_transit.length ? `${in_transit.length} поставк${in_transit.length === 1 ? "а" : "и"} · ETA ${fmtDate(in_transit[0].expected_at)}` : "открытых поставок нет"} />
      <Metric label={comp.horizon_days ? `Прогноз на ${comp.horizon_days} дн` : "Прогноз"} value={comp.forecast_qty !== undefined ? fmtNum(Math.round(comp.forecast_qty)) : "нет расчёта"} unit={comp.forecast_qty !== undefined ? unit : undefined} tone={forecast ? undefined : "warn"}
        sub={forecast ? `${fmtNum(forecast.base_rate, 1)} ${unit}/мес × сезон × рост ${fmtNum(forecast.growth, 2)}` : "запустите расчёт"} />
      <Metric label="Рекомендация" value={qty !== null ? fmtNum(qty) : "—"} unit={qty !== null ? unit : undefined} tone={urgency?.tone === "bad" ? "bad" : undefined}
        sub={rec ? (rec.qty_adjusted !== null ? `скорректировано · было ${fmtNum(rec.qty_recommended)}` : `кратность ${fmtNum(sku.moq)} · ${REC_STATE[rec.state ?? ""] ?? rec.state ?? "черновик"}`) : "нет рекомендации"} />
    </dl>
    <div className={styles.grid}>
      <div className={styles.main}>
        <Section id="sales" title="Продажи, 24 месяца" aside={<><Truth>по {lastYm ? fmtYm(lastYm) : "—"} · склад Алматы</Truth></>}>
          <Card className={styles.chartCard}>
            {months.length ? <Bars months={months} unit={unit} ariaLabel={`Продажи ${sku.code_1c} по месяцам, ${months.length} столбцов`} /> : <Empty title="Продаж за период нет" />}
          </Card>
          <div className={styles.chartNotes}>
            <span>Дефицит: {stockoutMonths.length ? stockoutMonths.map(fmtYm).join(", ") : "не было"}</span>
            <span>Исключено разовых документов: {outliers.length}{comp.outlier_threshold ? ` · порог ${fmtNum(comp.outlier_threshold)} ${unit}` : ""}</span>
            {comp.stockout_uplift ? <span>Компенсация дефицита +{fmtNum(comp.stockout_uplift, 1)} {unit}</span> : null}
          </div>
        </Section>
        <Section id="sources" title="Источники и даты" aside={<Truth>каждое число сверху выводится из этих строк</Truth>}>
          <Card className={styles.listCard}><Rows>
            <Row label={<Fact icon={<Database size={15} aria-hidden />}>Строки продаж (документы)</Fact>} meta={`с ${sku.first_sale_ym ? fmtYm(sku.first_sale_ym) : "—"} · ${sku.months_with_sales ?? 0} мес с продажами`} value={fmtNum(comp.sales_lines ?? series.reduce((a, s) => a + Number(s.qty_lines ?? 0) > 0 ? 1 : 0, 0))} valueMeta={`по ${lastYm ? fmtYm(lastYm) : "—"}`} />
            <Row label={<Fact icon={<Package size={15} aria-hidden />}>Остаток на складе (файл остатков)</Fact>} meta={comp.stock_stale ? "снимок старше текущего месяца" : `месяц ${comp.stock_month ? fmtYm(comp.stock_month) : lastYm ? fmtYm(lastYm) : "—"}`} value={sku.on_hand_qty === null ? "не задан" : fmtQty(sku.on_hand_qty, unit)} valueMeta={sku.on_hand_as_of ? `на ${fmtDate(sku.on_hand_as_of)}` : "нет даты"} />
            <Row label={<Fact icon={<FileSpreadsheet size={15} aria-hidden />}>В пути (файл поставок)</Fact>} meta={in_transit[0]?.source_file ? basename(in_transit[0].source_file) : "открытых поставок нет"} value={fmtQty(transitTotal, unit)} valueMeta={in_transit.length ? `ETA ${fmtDate(in_transit[0].expected_at)}` : "—"} />
            <Row label={<Fact icon={<Sigma size={15} aria-hidden />}>Сезонность</Fact>} meta={comp.season_source === "sku" ? "собственные месяцы позиции (≥ 12 с продажами)" : comp.season_source === "supplier" ? `выручка поставщика ${sku.supplier_name ?? sku.supplier_id} по месяцам` : "нет расчёта"} value={forecast ? `×${fmtNum(monthIndex(comp, lastYm), 2)}` : "—"} valueMeta={lastYm ? `индекс ${fmtYm(lastYm)}` : undefined} />
            <Row label={<Fact icon={<Coins size={15} aria-hidden />}>Себестоимость</Fact>} meta={sku.unit_cost === null ? "в файле поставщика нет — деньги по позиции не считаются" : `${sku.supplier_name ?? sku.supplier_id} · «СС реал»`} value={sku.unit_cost === null ? "не задана" : fmtMoney(sku.unit_cost, sku.currency)} valueMeta={sku.unit_cost === null ? undefined : `за ${unit}`} />
            <Row label={<Fact icon={<SlidersHorizontal size={15} aria-hidden />}>Политика</Fact>} meta={`срок поставки + период обзора = ${comp.horizon_days ?? "—"} дн · уровень сервиса 90 %`} value={comp.horizon_days ? `${comp.horizon_days} дн` : "—"} valueMeta="настраивается в параметрах поставщика" />
          </Rows></Card>
        </Section>
        {outliers.length > 0 && <Section id="outliers" title="Исключённые разовые документы" count={outliers.length} aside={<Truth>правило: строка &gt; max(20, min(3 × медиана месяца, 5 × p95 документа))</Truth>}>
          <Card className={styles.listCard}><Rows>{outliers.map(o => <Row key={o.doc_no} label={`Документ ${o.doc_no}`} meta={`${fmtYm(o.ym)} · порог ${fmtNum(o.threshold)} ${unit}`} value={`${fmtNum(o.qty)} ${unit}`} valueMeta="исключено из регулярного спроса" />)}</Rows></Card>
        </Section>}
      </div>
      <aside className={styles.rail} ref={rail} aria-label="Рекомендация и поставки">
        <RecommendationCard rec={rec} sku={sku} unit={unit} need={need} comp={comp} reload={reload} open={open} setOpen={setOpen} />
        {data.ekt && <EktBlock ekt={data.ekt} unit={unit} />}
        <section className={styles.block} aria-labelledby="transit">
          <h2 id="transit" className={styles.blockTitle}>В пути<span className={styles.blockCount}>{in_transit.length}</span></h2>
          {in_transit.length === 0 ? <Empty title="Открытых поставок нет">Строк по позиции в файле «в пути» не найдено — потребность считается без транзита.</Empty>
            : <div>{in_transit.map(t => <div key={t.id} data-row tabIndex={0} className={styles.transit}>
              <span className={styles.transitTop}><Truck size={14} aria-hidden />{fmtQty(t.qty, unit)} · ожидается {fmtDate(t.expected_at)}</span>
              <span className={styles.transitMeta}>{t.po_ref}</span>
              <span className={styles.transitMeta}>{t.source_file ? `из файла «${basename(t.source_file)}»` : "источник не указан"}</span>
            </div>)}</div>}
        </section>
        <section className={styles.block} aria-labelledby="timeline">
          <h2 id="timeline" className={styles.blockTitle}>Действия агента<span className={styles.blockCount}>{timeline.length}</span></h2>
          {timeline.length === 0 ? <Empty title="Действий пока нет">Появятся после запуска расчёта или события мира.</Empty>
            : <ol className={styles.feed}>{timeline.slice(0, 6).map(a => {
              const failed = a.result === "failed" || a.result === "error";
              return <li key={a.id} data-row tabIndex={0} className={styles.action}>
                <span className={`${styles.dot} ${failed ? styles.dot_bad : a.autonomy === "auto" ? "" : styles.dot_warn}`} aria-hidden />
                <div><div className={styles.actionTitle}>{a.summary_ru}</div><div className={styles.actionMeta}>{a.autonomy === "auto" ? "сам" : "нужны вы"} · {RESULT[a.result] ?? a.result}</div></div>
                <time className={styles.actionTime} dateTime={a.at}>{new Date(a.at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>
              </li>;
            })}</ol>}
        </section>
      </aside>
    </div>
  </>;
}

function Metric({ label, value, unit, sub, tone }: { label: string; value: string; unit?: string; sub: string; tone?: "bad" | "warn" }) {
  return <div className={`${styles.metric} ${tone ? styles[`metric_${tone}`] : ""}`}>
    <dt>{label}</dt><dd>{value}{unit && <small>{unit}</small>}</dd><p className={styles.metricSub}>{sub}</p>
  </div>;
}
function Fact({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) { return <span className={styles.rowLabel}>{icon}<span>{children}</span></span>; }

function RecommendationCard({ rec, sku, unit, need, comp, reload, open, setOpen }: { rec: Rec | null | undefined; sku: Sku; unit: string; need: number | null; comp: Components; reload: () => void; open: boolean; setOpen: (v: boolean) => void }) {
  const { refresh } = useApiSync();
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "stale" | "missing" | "error"; text: string } | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);
  const current = rec ? rec.qty_adjusted ?? rec.qty_recommended : 0;
  if (open !== prevOpen) { setPrevOpen(open); if (open) setQty(String(current)); }
  if (!rec) return <Card tone="alert"><p className={styles.railTitle}>Рекомендации нет</p><p className={styles.railBody}>Расчёт по этой позиции не выполнен: {sku.on_hand_qty === null ? "в файле остатков нет строки — без остатка потребность не считается." : "позиция не вошла в последний запуск или потребность равна нулю."}</p><p className={styles.railBody}>Запустите расчёт в разделе «Пополнение» — карточка обновится сама.</p></Card>;
  const urgency = URGENCY[rec.urgency] ?? URGENCY.none;
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setStatus(null);
    try {
      await apiRequest(`/api/recommendations/${encodeURIComponent(rec!.id)}/adjust`, { method: "POST", body: JSON.stringify({ qty: Number(qty), reason, version: rec!.version }) });
      setStatus({ kind: "ok", text: `Количество ${fmtNum(qty)} ${unit} сохранено.` }); setOpen(false); refresh();
    } catch (failure) {
      const e = failure instanceof ApiError ? failure : new ApiError(500, "unknown", "Не удалось сохранить.");
      if (e.status === 409) { setStatus({ kind: "stale", text: "Данные обновились — рекомендация пересчитана. Проверьте новое количество." }); refresh(); reload(); }
      else if (e.status === 404) setStatus({ kind: "missing", text: "Корректировка недоступна: количество можно изменить при утверждении заказа поставщику." });
      else setStatus({ kind: "error", text: e.message || "Не удалось сохранить." });
    } finally { setBusy(false); }
  }
  return <Card className={styles.recCard}>
    <div className={styles.recTop} id="rec"><h2 className={styles.railTitle} style={{ margin: 0 }}>Рекомендация</h2><Pill tone={urgency.tone}>{urgency.label}</Pill></div>
    <div className={styles.recQtyRow}><p className={styles.recQty}>{fmtNum(current)}</p><span className={styles.recUnit}>{unit} к заказу у {sku.supplier_name ?? sku.supplier_id}</span></div>
    <div className={styles.chips}>
      <Pill>{REC_STATE[rec.state ?? ""] ?? rec.state ?? "черновик"}</Pill>
      {rec.qty_adjusted !== null && <Pill tone="warn">агент предлагал {fmtNum(rec.qty_recommended)}</Pill>}
      {sku.unit_cost === null ? <Pill tone="warn">себестоимость не задана</Pill> : <Pill tone="good">{fmtMoney(sku.unit_cost, sku.currency)} за {unit}</Pill>}
    </div>
    <dl className={styles.receipt}>
      <dt>Прогноз на {comp.horizon_days ?? "—"} дн</dt><dd>{fmtNum(comp.forecast_qty, 1)}</dd>
      <dt>+ Страховой запас</dt><dd>{fmtNum(comp.safety, 1)}</dd>
      <dt>− Остаток{comp.on_hand_as_of ? ` на ${fmtDate(comp.on_hand_as_of)}` : ""}</dt><dd>{fmtNum(rec.on_hand)}</dd>
      <dt>− В пути</dt><dd>{fmtNum(rec.in_transit)}</dd>
      <dt className={styles.receiptTotal}>= Потребность</dt><dd className={styles.receiptTotal}>{need === null ? "—" : fmtNum(Math.max(0, need), 1)}</dd>
      <dt>Кратность {fmtNum(sku.moq)} → к заказу</dt><dd><strong>{fmtNum(rec.qty_recommended)} {unit}</strong></dd>
      {rec.qty_adjusted !== null && <><dt>Ваша корректировка</dt><dd><strong>{fmtNum(rec.qty_adjusted)} {unit}</strong></dd></>}
    </dl>
    <details className={styles.why}><summary>Почему так</summary><p>{rec.rationale_ru}</p></details>
    {status && <p className={`${styles.status} ${styles[`status_${status.kind}`]}`} role={status.kind === "ok" ? "status" : "alert"}>{status.kind === "ok" ? <CheckCircle2 size={16} aria-hidden /> : <AlertTriangle size={16} aria-hidden />}<span>{status.text}</span></p>}
    {!open ? <div className={styles.recActions}><Btn variant="primary" onClick={() => setOpen(true)}>Скорректировать</Btn><Btn variant="quiet" onClick={() => { void navigator.clipboard?.writeText(rec.rationale_ru); }}>Копировать обоснование</Btn></div>
      : <form className={styles.adjust} onSubmit={submit} onKeyDown={e => { if (e.key === "Escape") setOpen(false); }}>
        <label>Количество, {unit}<input autoFocus inputMode="numeric" pattern="[0-9]*" value={qty} onChange={e => setQty(e.target.value.replace(/\D/g, ""))} required /></label>
        <label>Причина<input value={reason} onChange={e => setReason(e.target.value)} placeholder="например, акция у клиента в ноябре" required /></label>
        <div className={styles.recActions}><Btn variant="black" type="submit" busy={busy} disabled={!qty || !reason.trim()}>Сохранить</Btn><Btn variant="quiet" type="button" onClick={() => setOpen(false)}>Отмена (Esc)</Btn></div>
      </form>}
  </Card>;
}
function EktBlock({ ekt, unit }: { ekt: Ekt; unit: string }) {
  const live = ekt.source === "ekt_api_live";
  const truth = live ? "Каталог ekt.kz · текущий ответ" : `Каталог ekt.kz · сохранённый снимок${ekt.as_of ? ` от ${fmtDate(ekt.as_of)}` : ""}`;
  const byWh: { warehouse: string; qty: number | string }[] = Array.isArray(ekt.stock_by_warehouse) ? ekt.stock_by_warehouse : ekt.stock_by_warehouse ? Object.entries(ekt.stock_by_warehouse).map(([warehouse, qty]) => ({ warehouse, qty })) : [];
  const price = ekt.price === null || ekt.price === undefined || ekt.price === "" ? null : fmtMoney(String(ekt.price), ekt.currency ?? "KZT");
  return <section className={styles.block} aria-labelledby="ekt">
    <div className={styles.recTop}><h2 id="ekt" className={styles.blockTitle}>Каталог ekt.kz</h2>{ekt.url && <a className={styles.ektLink} href={ekt.url} target="_blank" rel="noreferrer">страница товара ↗</a>}</div>
    <div>
      <div className={styles.kv}><b>Цена поставщика</b><span className={styles.kvNum}>{price ?? "не указана"}</span></div>
      <div className={styles.kv}><b>Остаток у поставщика</b><span className={styles.kvNum}>{ekt.stock_total === null || ekt.stock_total === undefined ? "не указан" : fmtQty(ekt.stock_total, unit)}</span></div>
      {ekt.availability && <div className={styles.kv}><b>Наличие</b><span className={styles.kvNum}>{ekt.availability}</span></div>}
    </div>
    {byWh.length > 0 && <details className={styles.kvWh}><summary>По складам · {byWh.length}</summary><div>{byWh.map(w => <div key={w.warehouse} className={styles.kv}><b>{w.warehouse}</b><span className={styles.kvNum}>{fmtQty(w.qty, unit)}</span></div>)}</div></details>}
    <Truth>{truth}{ekt.as_of && live ? ` · ${fmtDate(ekt.as_of)}` : ""}</Truth>
  </section>;
}
function basename(path: string) { return path.split("/").pop() ?? path; }
function monthIndex(comp: Components & { season?: Record<string, number> }, ym?: string) { if (!ym || !comp.season) return 1; return comp.season[String(Number(ym.slice(5, 7)))] ?? 1; }
