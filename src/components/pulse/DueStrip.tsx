import Link from "next/link";
import type { MoneyView } from "./types";
import { formatDate, formatMoney } from "./format";
import styles from "./pulse.module.css";
export function DueStrip({ money }: { money?: MoneyView | null }) {
  const next = money?.next_60d?.out?.[0];
  if (!next) return null;
  return <section className={styles.dueStrip} aria-label="Ближайшее обязательство"><div><span className={styles.meta}>Ближайший платёж · {formatDate(next.at)}</span><Link href={`/orders/${encodeURIComponent(next.po_id)}`}>{next.po_id}</Link></div><strong>{formatMoney(next)}</strong><Link href="/money">График платежей</Link></section>;
}
