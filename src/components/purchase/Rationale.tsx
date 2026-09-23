import { number, type Components, type Recommendation } from "./types";
import styles from "./workspace.module.css";

export function NeedFormula({ components, qty }: { components: Components; qty: Recommendation["qty_recommended"] }) {
  return <div className={styles.formula} aria-label="Расчёт потребности"><span>Прогноз <b>{number(components.forecast_qty)}</b></span><span>+ страховой запас <b>{number(components.safety)}</b></span><span>− остаток <b>{number(components.on_hand)}</b></span><span>− в пути <b>{number(components.in_transit)}</b></span><span>− утверждённый заказ <b>{number(components.approved_order_qty ?? 0)}</b></span><span>= <strong>{number(qty)} шт.</strong></span></div>;
}
export function Rationale({ row }: { row: Recommendation }) {
  const c = row.components ?? {};
  const excluded = row.outliers_excluded ?? c.outliers_excluded ?? [];
  const months = row.stockout_months ?? c.stockout_months ?? [];
  return <div className={styles.rationale}>
    <NeedFormula components={c} qty={row.qty_recommended} />
    <p>{row.rationale_ru || "Расчёт ещё не содержит обоснования."}</p>
    <div className={styles.formula}><span>Горизонт: {number(c.horizon_days, 0)} дн.</span><span>Регулярный спрос: {number(c.base_rate)} шт./мес.</span><span>Рост: ×{number(c.growth)}</span><span>Кратность: {number(row.moq ?? c.moq)}</span></div>
    {!!months.length && <p>Компенсация дефицита: +{number(c.stockout_uplift)} шт./мес. Месяцы без остатка: {months.join(", ")}.</p>}
    {!!excluded.length && <div><strong>Исключены разовые документы</strong><ul className={styles.sources}>{excluded.map((doc, i) => <li key={doc.id ?? `${doc.doc_no}-${i}`}>{doc.doc_no} · {number(doc.qty)} шт. · {doc.rule || "выше порога регулярного спроса"}</li>)}</ul></div>}
  </div>;
}
