import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/shell";
import { formatMoney, sumByCurrency } from "./format";
import type { TodayResponse, MoneyView } from "./types";
import styles from "./pulse.module.css";
export function MoneyStrip({ money, risk, loading }: { money?: MoneyView | null; risk?: NonNullable<TodayResponse["pulse"]>["stockout_risk"]; loading?: boolean }) {
  const out = money ? sumByCurrency(money.next_60d?.out ?? []) : [];
  return <section className={styles.moneyStrip} aria-label="Денежный пульс">
    <div className={styles.moneyCell}><span className={styles.label}>Обязательства поставщикам</span>{loading ? <Skeleton lines={2} /> : money?.committed_by_supplier?.length ? money.committed_by_supplier.map(row => <div key={`${row.supplier_id}-${row.currency}`} className={styles.supplierMoney}><strong>{formatMoney(row)}</strong><span className={styles.meta}>{row.supplier_id}{row.cost_known_lines < row.lines ? " · часть позиций без стоимости" : ""}</span></div>) : <><strong className={styles.wordValue}>{money && !money.empty_reason ? "Нет обязательств" : "Нет данных"}</strong><span className={styles.meta}>По утверждённым заказам</span></>}</div>
    <div className={styles.moneyCell}><span className={styles.label}>Отток · 60 дней</span>{loading ? <Skeleton lines={2} /> : <><strong>{out.length ? out.map(row => <span className={styles.currency} key={row.currency}>{formatMoney(row)}</span>) : <span className={styles.wordValue}>{money && !money.empty_reason ? "Не запланирован" : "Нет данных"}</span>}</strong><span className={styles.meta}>Предоплата и остаток к поставке</span></>}</div>
    <div className={styles.moneyCell}><span className={styles.label}>Стоимость запаса (SE)</span>{loading ? <Skeleton lines={2} /> : <><strong className={!money?.stock_value ? styles.wordValue : undefined}>{money?.stock_value ? formatMoney(money.stock_value) : "Не рассчитана"}</strong><span className={styles.meta}>IEK: себестоимость не задана</span></>}</div>
    <div className={styles.moneyCell}><span className={styles.label}>Риск дефицита</span>{loading ? <Skeleton lines={2} /> : <><strong className={risk && risk.count > 0 ? styles.dangerValue : undefined}>{risk ? risk.count.toLocaleString("ru-RU") : "—"}</strong><span className={styles.meta}>Товаров с запасом меньше срока поставки</span></>}<Link className={styles.detailLink} href="/money">Подробнее <ArrowUpRight size={14} /></Link></div>
  </section>;
}
