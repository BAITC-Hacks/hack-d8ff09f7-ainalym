import Link from "next/link";
import { Chip, TaskStateChip } from "@/components/labels";
import { EmptyState, Skeleton } from "@/components/shell";
import { formatMoney, safeHref } from "./format";
import type { Commitment } from "./types";
import styles from "./pulse.module.css";
const states: Record<string,string> = { draft: "черновик", approved: "утверждено", exported: "экспортировано", done: "расчёт завершён", running: "рассчитывается", failed: "ошибка расчёта", completed: "расчёт завершён" };
export function Commitments({ rows, loading }: { rows?: Commitment[]; loading: boolean }) {
  return <section className={styles.panel} aria-labelledby="commitments-title"><div className={styles.sectionHead}><h2 id="commitments-title">Обязательства</h2><Link href="/replenishment">Все закупки</Link></div>{loading ? <Skeleton lines={3} /> : rows?.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Обязательство</th><th>Следующее событие</th><th>Сумма / основание</th><th>Ответственный</th><th>Состояние</th></tr></thead><tbody>{rows.slice(0,60).map(row => <tr key={`${row.kind}-${row.id}`}><td><Link href={safeHref(row.href, row.kind === "run" ? `/replenishment?run_id=${encodeURIComponent(row.id)}` : `/orders/${encodeURIComponent(row.id)}`)}>{row.title}</Link></td><td>{row.next_event || "Не запланировано"}</td><td>{row.amount ? formatMoney(row.amount) : row.kind === "run" ? "Расчёт потребности" : "Себестоимость не задана"}</td><td>{row.owner || "Не указан"}</td><td>{states[row.state] ? <Chip tone={row.state === "failed" ? "danger" : "neutral"}>{states[row.state]}</Chip> : <TaskStateChip state={row.state} />}</td></tr>)}</tbody></table></div> : <EmptyState>{rows ? "Заказов и расчётов пока нет. Начните с расчёта пополнения." : "Обязательства пока недоступны."}</EmptyState>}</section>;
}
