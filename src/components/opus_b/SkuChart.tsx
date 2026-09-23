"use client";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { Components, Forecast, SeriesPoint } from "./types";
import { qty, toNum, ym, ymLong } from "./format";
import s from "./sku.module.css";

type Doc = { doc_no: string; qty: number };
type Slot = { ym: string; future: boolean; total: number; excluded: number; docs: Doc[]; stockout: boolean; stock: number | null; stockKnown: boolean; forecast: number | null; partial: boolean };

const HIST = 24;
const FUTURE = 6;
const H = 300;
const PAD = { left: 56, right: 12, top: 36, bottom: 30 };

function addMonths(value: string, n: number) {
  const [y, m] = value.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function niceTop(max: number) {
  const target = Math.max(max, 1) / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(target)));
  const n = target / pow;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
  return { step, top: step * Math.max(1, Math.ceil(max / step)) };
}

export function buildSlots(series: SeriesPoint[], c?: Components | null, forecast?: Forecast | null): Slot[] {
  const stockouts = new Set<string>([...(c?.stockout_months ?? []), ...series.filter(p => p.stockout === 1).map(p => p.ym)]);
  const docs = new Map<string, Doc[]>();
  const push = (key: string, doc: Doc) => { const list = docs.get(key) ?? []; if (!list.some(d => d.doc_no === doc.doc_no)) list.push(doc); docs.set(key, list); };
  for (const d of c?.outliers_excluded ?? []) push(d.ym, { doc_no: d.doc_no ?? "без номера", qty: d.qty });
  for (const p of series) for (const o of p.outliers ?? []) {
    if (o.decision === "keep" || o.decision === "include") continue;
    const q = toNum(o.qty as string | number | undefined); if (q === null) continue;
    push(p.ym, { doc_no: o.doc_no ?? "без номера", qty: q });
  }
  const asOf = c?.on_hand_as_of ?? "";
  const partialYm = asOf && Number(asOf.slice(8, 10)) < 28 ? asOf.slice(0, 7) : "";
  const hist: Slot[] = series.slice(-HIST).map(p => {
    const total = Math.max(0, toNum(p.qty_file) ?? toNum(p.qty_lines) ?? 0);
    const list = docs.get(p.ym) ?? [];
    const excluded = Math.min(total, list.reduce((sum, d) => sum + d.qty, 0));
    return { ym: p.ym, future: false, total, excluded, docs: list, stockout: stockouts.has(p.ym), stock: toNum(p.stock), stockKnown: p.stock_known, forecast: null, partial: p.ym === partialYm };
  });
  const base = c?.base_rate ?? toNum(forecast?.base_rate);
  const season = c?.season ?? forecast?.season ?? null;
  const growth = c?.growth ?? toNum(forecast?.growth) ?? 1;
  const last = hist.at(-1)?.ym;
  const future: Slot[] = last && base !== null && base !== undefined && season ? Array.from({ length: FUTURE }, (_, i) => {
    const key = addMonths(last, i + 1);
    const idx = season[String(Number(key.slice(5, 7)))] ?? 1;
    return { ym: key, future: true, total: 0, excluded: 0, docs: [], stockout: false, stock: null, stockKnown: false, forecast: base * idx * growth, partial: false };
  }) : [];
  return [...hist, ...future];
}

function summary(slot: Slot) {
  if (slot.future) return `${ymLong(slot.ym)}: прогноз ${qty(slot.forecast)} шт в месяц.`;
  const parts = [`${ymLong(slot.ym)}: продано ${qty(slot.total)} шт`];
  if (slot.excluded) parts.push(`исключено ${qty(slot.excluded)} шт разовых`);
  if (slot.stockout) parts.push("дефицит — продажи ограничены остатком");
  if (slot.stock !== null) parts.push(`остаток на начало ${qty(slot.stock)} шт`);
  return `${parts.join(", ")}.`;
}

export function SkuChart({ series, components, forecast }: { series: SeriesPoint[]; components?: Components | null; forecast?: Forecast | null }) {
  const slots = useMemo(() => buildSlots(series, components, forecast), [series, components, forecast]);
  const histCount = slots.filter(x => !x.future).length;
  const [selected, setSelected] = useState(Math.max(0, histCount - 1));
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(820);
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(300, Math.round(entry.contentRect.width))));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  if (slots.length === 0) return <div className={s.chartEmpty}>Истории продаж нет — прогноз не строится.</div>;
  const sel = Math.min(selected, slots.length - 1);
  const plotW = width - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slotW = plotW / slots.length;
  const barW = Math.max(4, Math.min(26, slotW * 0.62));
  const maxVal = Math.max(...slots.map(x => x.future ? (x.forecast ?? 0) : x.total), 1);
  const { step, top } = niceTop(maxVal * 1.06);
  const y = (v: number) => PAD.top + plotH - (Math.max(0, v) / top) * plotH;
  const cx = (i: number) => PAD.left + slotW * (i + 0.5);
  const ticks: number[] = []; for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
  const every = width < 560 ? 6 : 3;
  const clear = Math.ceil(46 / slotW); // keep regular month labels clear of the selected one
  const futureIdx = slots.map((x, i) => (x.future ? i : -1)).filter(i => i >= 0);
  const line = futureIdx.map((i, k) => `${k === 0 ? "M" : "L"}${cx(i).toFixed(1)},${y(slots[i].forecast ?? 0).toFixed(1)}`).join(" ");
  const area = futureIdx.length ? `${line} L${cx(futureIdx.at(-1)!).toFixed(1)},${y(0)} L${cx(futureIdx[0]).toFixed(1)},${y(0)} Z` : "";
  // order horizon: from the stock as-of date, horizon_days forward
  const asOf = components?.on_hand_as_of;
  const horizonDays = components?.horizon_days ?? 0;
  let horizon: { x: number; w: number } | null = null;
  if (asOf && horizonDays > 0) {
    const i0 = slots.findIndex(x => x.ym === asOf.slice(0, 7));
    if (i0 >= 0) {
      const [yy, mm, dd] = asOf.split("-").map(Number);
      const dim = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
      const x0 = PAD.left + slotW * (i0 + (dd - 1) / dim);
      const x1 = Math.min(PAD.left + plotW, x0 + (horizonDays / 30.44) * slotW);
      horizon = { x: x0, w: Math.max(8, x1 - x0) };
    }
  }
  const divider = histCount < slots.length ? PAD.left + slotW * histCount : null;
  const cur = slots[sel];
  const tipTopValue = cur.future ? (cur.forecast ?? 0) : cur.total;
  const tipLeft = Math.min(Math.max(cx(sel) - 112, 0), Math.max(0, width - 224));
  const tipTop = Math.max(0, y(tipTopValue) - 118);
  const pick = (e: MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - r.left - PAD.left) / slotW);
    if (i >= 0 && i < slots.length && i !== sel) setSelected(i);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = e.key === "ArrowLeft" ? sel - 1 : e.key === "ArrowRight" ? sel + 1 : e.key === "Home" ? 0 : e.key === "End" ? slots.length - 1 : null;
    if (next === null) return;
    e.preventDefault(); setSelected(Math.min(Math.max(next, 0), slots.length - 1));
  };
  return <div className={s.chartWrap}>
    <div ref={wrap} className={s.chart} tabIndex={0} role="group" data-ob-chart="" aria-roledescription="график" onKeyDown={onKey}
      aria-label="Продажи за 24 месяца и прогноз на 6 месяцев. Стрелки влево и вправо выбирают месяц.">
      <svg width={width} height={H} className={s.svg} onMouseMove={pick} aria-hidden>
        <defs>
          <pattern id="ob-hatch-stock" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" className={s.hatchStockBg} /><line x1="0" y1="0" x2="0" y2="6" className={s.hatchStockLine} /></pattern>
          <pattern id="ob-hatch-excl" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="5" className={s.hatchExclLine} /></pattern>
        </defs>
        {slots.map((x, i) => x.stockout ? <g key={`band-${x.ym}`}><rect x={PAD.left + slotW * i} y={PAD.top} width={slotW} height={plotH} className={s.band} />{!slots[i - 1]?.stockout && <text x={PAD.left + slotW * i + 4} y={PAD.top + 12} className={s.bandText}>дефицит</text>}</g> : null)}
        {ticks.map(v => <g key={v}>
          <line x1={PAD.left} x2={PAD.left + plotW} y1={y(v)} y2={y(v)} className={v === 0 ? s.axis : s.grid} />
          <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" className={s.tick}>{qty(v)} шт</text>
        </g>)}
        {horizon && <g>
          <rect x={horizon.x} y={8} width={horizon.w} height={18} rx={4} className={s.horizon} />
          <text x={horizon.x + 8} y={21} className={s.horizonText}>{horizon.w > 150 ? `горизонт заказа · ${horizonDays} дн` : `${horizonDays} дн`}</text>
        </g>}
        {divider !== null && <g>
          <line x1={divider} x2={divider} y1={PAD.top - 4} y2={PAD.top + plotH} className={s.divider} />
          <text x={divider + 6} y={PAD.top + 10} className={s.dividerText}>прогноз</text>
        </g>}
        {slots.map((x, i) => {
          if (x.future) return null;
          const regular = x.total - x.excluded;
          const bx = cx(i) - barW / 2;
          const on = i === sel;
          return <g key={x.ym}>
            {regular > 0 && <rect x={bx} y={y(regular)} width={barW} height={y(0) - y(regular)} rx={2} className={`${x.stockout ? s.barStock : on ? s.barOn : s.bar} ${x.stockout && on ? s.barStockOn : ""}`} />}
            {x.excluded > 0 && <rect x={bx + 0.5} y={y(x.total)} width={barW - 1} height={Math.max(2, y(regular) - y(x.total))} rx={2} className={s.excl} />}
            {x.partial && <text x={cx(i)} y={y(x.total) - 6} textAnchor="middle" className={s.partial}>…</text>}
          </g>;
        })}
        {area && <path d={area} className={s.fArea} />}
        {line && <path d={line} className={s.fLine} />}
        {futureIdx.map(i => <circle key={slots[i].ym} cx={cx(i)} cy={y(slots[i].forecast ?? 0)} r={i === sel ? 5.5 : 3.5} className={s.fDot} />)}
        <line x1={cx(sel)} x2={cx(sel)} y1={PAD.top} y2={PAD.top + plotH} className={s.cursor} />
        {slots.map((x, i) => (i === sel || ((slots.length - 1 - i) % every === 0 && Math.abs(i - sel) >= clear)) ? <text key={`l-${x.ym}`} x={cx(i)} y={H - 10} textAnchor="middle" className={i === sel ? s.monthOn : s.month}>{ym(x.ym)}</text> : null)}
      </svg>
      <div className={s.tip} style={{ left: tipLeft, top: tipTop }} aria-hidden>
        <div className={s.tipHead}>{ymLong(cur.ym)}{cur.future ? " · прогноз" : cur.partial ? " · месяц не закрыт" : ""}</div>
        {cur.future ? <div className={s.tipRow}><span>Прогноз</span><b>{qty(cur.forecast)} шт/мес</b></div> : <>
          <div className={s.tipRow}><span>Продажи</span><b>{qty(cur.total)} шт</b></div>
          {cur.excluded > 0 && <div className={`${s.tipRow} ${s.tipBad}`}><span>Исключено</span><b>−{qty(cur.excluded)} шт</b></div>}
          {cur.docs.map(d => <div key={d.doc_no} className={s.tipDoc}>док. {d.doc_no} · {qty(d.qty)} шт</div>)}
          <div className={s.tipRow}><span>Остаток на начало</span><b>{cur.stock === null ? "нет данных" : `${qty(cur.stock)} шт`}</b></div>
          {cur.stockout && <div className={s.tipFlag}>Дефицит — продажи ограничены</div>}
        </>}
      </div>
    </div>
    <p className={s.live} aria-live="polite" data-ob-chart-live="">{summary(cur)}</p>
    <ul className={s.legend} aria-label="Обозначения">
      <li><i className={s.swBar} aria-hidden />продажи, шт</li>
      <li><i className={s.swStock} aria-hidden />дефицит</li>
      <li><i className={s.swExcl} aria-hidden />исключено (разовые)</li>
      <li><i className={s.swFc} aria-hidden />прогноз, шт/мес</li>
      <li className={s.legendHint}>← → выбрать месяц</li>
    </ul>
  </div>;
}
