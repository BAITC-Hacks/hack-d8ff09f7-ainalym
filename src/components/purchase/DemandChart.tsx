import { number, type SeriesPoint } from "./types";
import styles from "./workspace.module.css";

export function chartPoints(series: SeriesPoint[], forecast: Record<string, number>) {
  const history = series.slice(-36);
  const months = [...new Set([...history.map(p => p.ym), ...Object.keys(forecast)])].sort();
  return months.map(ym => ({ ym, actual: history.find(p => p.ym === ym)?.qty_file, regular: history.find(p => p.ym === ym)?.qty_regular, forecast: forecast[ym], stockout: history.find(p => p.ym === ym)?.stockout, outliers: history.find(p => p.ym === ym)?.outliers ?? [] }));
}
export function DemandChart({ series, forecast = {} }: { series: SeriesPoint[]; forecast?: Record<string, number> }) {
  const points = chartPoints(series, forecast);
  if (!points.length) return <p className={styles.notice}>История продаж ещё не получена. График появится после загрузки данных.</p>;
  const values = points.flatMap(p => [p.actual, p.regular, p.forecast]).filter(v => v !== null && v !== undefined && Number.isFinite(Number(v))).map(Number);
  const max = Math.max(1, ...values), min = Math.min(0, ...values);
  const x = (i: number) => 48 + i * 824 / Math.max(1, points.length - 1);
  const y = (value: number) => 210 - (value - min) / (max - min) * 184;
  const path = (key: "actual" | "regular" | "forecast") => { let open = false; return points.map((p, i) => { const value = p[key]; if (value === null || value === undefined || !Number.isFinite(Number(value))) { open = false; return ""; } const command = open ? "L" : "M"; open = true; return `${command}${x(i)},${y(Number(value))}`; }).join(" "); };
  return <div className={styles.stack}>
    <svg className={styles.chart} viewBox="0 0 900 256" role="img" aria-labelledby="demand-title demand-desc"><title id="demand-title">Продажи, регулярный спрос и прогноз</title><desc id="demand-desc">До 36 месяцев истории. Серый фон отмечает месяцы без остатка, кружки — разовые документы. Числа доступны в таблице под графиком.</desc>
      {points.map((p, i) => p.stockout ? <rect key={p.ym} className={styles.stockout} x={x(i) - 8} y="20" width="16" height="194" /> : null)}
      {[min, (max + min) / 2, max].map((value, i) => <g key={i}><line className={styles.chartGrid} x1="48" x2="876" y1={y(value)} y2={y(value)} /><text x="40" y={y(value) + 4} textAnchor="end">{number(value, 0)}</text></g>)}
      <path className={styles.actualLine} d={path("actual")} /><path className={styles.regularLine} d={path("regular")} /><path className={styles.forecastLine} d={path("forecast")} />
      {points.map((p, i) => p.outliers.length && p.actual !== null && p.actual !== undefined ? <circle key={p.ym} className={styles.outlier} cx={x(i)} cy={y(Number(p.actual))} r="4"><title>{p.ym}: {p.outliers.map(d => `${d.doc_no}, ${number(d.qty)} шт.`).join("; ")}</title></circle> : null)}
      {points.map((p, i) => i % Math.max(1, Math.ceil(points.length / 5)) === 0 || i === points.length - 1 ? <text key={p.ym} x={x(i)} y="242" textAnchor="middle">{p.ym}</text> : null)}
    </svg>
    <div className={styles.legend}><span><i />Факт</span><span><i className={styles.regularKey} />Регулярный спрос</span><span><i className={styles.forecastKey} />Прогноз</span><span><i className={styles.stockoutKey} />Без остатка</span><span>○ Разовый документ</span></div>
    <details className={styles.disclosure}><summary>Показать значения по месяцам</summary><div className={styles.scrollTable}><table className={styles.table}><thead><tr><th>Месяц</th><th>Факт</th><th>Регулярный</th><th>Прогноз</th><th>Дефицит / документы</th></tr></thead><tbody>{points.map(p => <tr key={p.ym}><th scope="row">{p.ym}</th><td>{number(p.actual)}</td><td>{number(p.regular)}</td><td>{number(p.forecast)}</td><td>{p.stockout ? "Без остатка. " : ""}{p.outliers.map(d => d.doc_no).join(", ") || "—"}</td></tr>)}</tbody></table></div></details>
  </div>;
}
