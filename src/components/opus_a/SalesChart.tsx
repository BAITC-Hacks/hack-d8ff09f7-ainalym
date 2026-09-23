"use client";
import { monthLong, monthShort, qty } from "./format";

export type SeriesPoint = { ym: string; qty_file: string | null; qty_lines: string | null; stockout: number; stock: string | null; stock_known: boolean; outliers: { qty?: number | string; doc_no?: string }[] };
type Props = { series: SeriesPoint[]; forecast: Record<string, number>; excluded: { ym: string; qty: number; doc_no: string }[]; stockoutMonths: string[]; months?: number };

/** 24-month sales bars (regular + excluded one-off part), stockout months shaded, forecast drawn as a dashed line. */
export function SalesChart({ series, forecast, excluded, stockoutMonths, months = 24 }: Props) {
  const hist = series.slice(-months);
  const lastYm = hist[hist.length - 1]?.ym ?? "";
  const future = Object.keys(forecast).filter(ym => ym > lastYm).sort();
  const slots = [...hist.map(h => h.ym), ...future];
  const so = new Set([...stockoutMonths, ...hist.filter(h => h.stockout).map(h => h.ym)]);
  const excl = new Map<string, number>();
  excluded.forEach(o => excl.set(o.ym, (excl.get(o.ym) ?? 0) + Number(o.qty)));
  const bars = hist.map(h => { const total = Math.max(0, Number(h.qty_lines ?? h.qty_file ?? 0)); const x = Math.min(total, excl.get(h.ym) ?? 0); return { ym: h.ym, total, regular: total - x, excluded: excl.get(h.ym) ?? 0 }; });
  const maxV = Math.max(1, ...bars.map(b => Math.max(b.total, b.excluded)), ...Object.values(forecast)) * 1.12;
  const W = 660, H = 270, L = 40, R = 6, T = 14, B = 30;
  const cw = (W - L - R) / slots.length, bw = Math.max(6, cw * 0.62);
  const y = (v: number) => T + (H - T - B) * (1 - v / maxV);
  const x = (i: number) => L + i * cw + cw / 2;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxV / 1.12 * f));
  const fPts = Object.keys(forecast).sort().map(ym => ({ ym, i: slots.indexOf(ym), v: forecast[ym] })).filter(p => p.i >= 0);
  const summary = `Продажи за ${hist.length} мес: от ${monthLong(hist[0]?.ym ?? "")} до ${monthLong(lastYm)}; месяцев без остатка ${so.size}; исключённых разовых документов ${excluded.length}; прогноз на ${fPts.length} мес.`;
  return <svg className="oa-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
    <defs>
      <pattern id="oa-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#f1e5c8" /><line x1="0" y1="0" x2="0" y2="6" stroke="#b07a12" strokeWidth="2" /></pattern>
      <linearGradient id="oa-fc" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#5b3b58" stopOpacity=".22" /><stop offset="1" stopColor="#5b3b58" stopOpacity="0" /></linearGradient>
    </defs>
    {ticks.map(t => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#d6d3ca" strokeDasharray={t === 0 ? undefined : "3 4"} /><text x={L - 8} y={y(t) + 4} textAnchor="end">{qty(t)}</text></g>)}
    {slots.map((ym, i) => so.has(ym) ? <g key={`so-${ym}`}><rect x={L + i * cw + 1} y={T} width={cw - 2} height={H - T - B} fill="#efe2d6" /><rect x={x(i) - 3} y={H - B + 3} width={6} height={4} rx={1} fill="#c2432a" /></g> : null)}
    {future.length ? <rect x={L + hist.length * cw} y={T} width={future.length * cw} height={H - T - B} fill="#5b3b58" opacity=".05" /> : null}
    {bars.map((b, i) => <g key={b.ym}>
      <title>{`${monthLong(b.ym)}: продано ${qty(b.total)} шт${b.excluded ? `, из них разовые документы ${qty(b.excluded)} шт — исключены` : ""}${so.has(b.ym) ? "; месяц без остатка — спрос восстановлен" : ""}`}</title>
      <rect x={x(i) - bw / 2} y={y(b.regular)} width={bw} height={Math.max(0, y(0) - y(b.regular))} rx={2} fill={i >= hist.length - 12 ? "#6f84c0" : "#aab5d3"} />
      {b.excluded ? <rect x={x(i) - bw / 2} y={y(b.regular + b.excluded)} width={bw} height={Math.max(2, y(b.regular) - y(b.regular + b.excluded))} rx={2} fill="url(#oa-hatch)" stroke="#b07a12" strokeWidth=".8" /> : null}
    </g>)}
    {fPts.length > 1 ? <path d={`M${fPts.map(p => `${x(p.i)},${y(p.v)}`).join(" L")} L${x(fPts[fPts.length - 1].i)},${y(0)} L${x(fPts[0].i)},${y(0)} Z`} fill="url(#oa-fc)" /> : null}
    {fPts.length ? <path d={`M${fPts.map(p => `${x(p.i)},${y(p.v)}`).join(" L")}`} fill="none" stroke="#5b3b58" strokeWidth="2" strokeDasharray="5 4" /> : null}
    {fPts.map(p => <circle key={p.ym} cx={x(p.i)} cy={y(p.v)} r="3.5" fill="#f4f3ef" stroke="#5b3b58" strokeWidth="2"><title>{`${monthLong(p.ym)}: прогноз ${qty(p.v, 1)} шт`}</title></circle>)}
    {slots.map((ym, i) => (i % 2 === 0 || slots.length <= 14) ? <text key={`l-${ym}`} x={x(i)} y={H - 8} textAnchor="middle">{ym.endsWith("-01") ? ym.slice(0, 4) : monthShort(ym)}</text> : null)}
  </svg>;
}
