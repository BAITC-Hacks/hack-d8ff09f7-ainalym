"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Chip, TruthLabels, type TruthAxes } from "@/components/labels";
import { Button, EmptyState, LoadError, Skeleton, useApi } from "@/components/shell";
import { amountLabel, dateLabel } from "./format";
import styles from "./lists.module.css";
type Order = { id: string; supplier_id: string; state: string; total_qty: number; total_cost?: string | null; currency?: string; eta?: string; version: number; lines?: unknown[]; axes?: TruthAxes };
type OrdersResponse = TruthAxes & { orders: Order[]; axes?: TruthAxes };
export function OrderList() {
  const api = useApi<OrdersResponse>("/api/orders");
  const [supplier, setSupplier] = useState("");
  const rows = api.data?.orders ?? [];
  const shown = rows.filter(row => !supplier || row.supplier_id === supplier);
  return <div className={styles.page}><header className={styles.header}><div><p className={styles.eyebrow}>ПОПОЛНЕНИЕ СКЛАДА</p><h1>Заказы поставщикам</h1><p className={styles.subtitle}>Подготовленные, утверждённые и выгруженные заказы.</p></div><Link className={styles.actionLink} href="/replenishment">К расчёту<ArrowUpRight size={16} /></Link></header>
    <div className={styles.toolbar}><label>Поставщик<select value={supplier} onChange={event => setSupplier(event.target.value)}><option value="">Все поставщики</option>{Array.from(new Set(rows.map(row => row.supplier_id))).sort().map(value => <option key={value}>{value}</option>)}</select></label><span className={styles.meta} role="status">{api.data ? `Заказов: ${shown.length}` : ""}</span><Button onClick={api.reload}>Обновить</Button></div>
    {api.error && <LoadError message={api.data ? "Не удалось обновить заказы — показываю последнее." : api.error.message} retry={api.reload} />}
    {api.loading ? <Skeleton lines={5} /> : shown.length ? <ul className={styles.rows}>{shown.map(order => <li key={order.id} className={styles.order}><div className={styles.rowMain}><div className={styles.rowHead}><h2><Link href={`/orders/${encodeURIComponent(order.id)}`}>{order.id}</Link></h2><Chip>{({ draft: "Черновик заказа — не отправлен", approved: "Заказ утверждён", exported: "Файл экспортирован" } as Record<string,string>)[order.state] ?? order.state}</Chip></div><p>{order.supplier_id} · {order.total_qty.toLocaleString("ru-RU")} шт.{order.lines ? ` · позиций: ${order.lines.length}` : ""}</p><p className={styles.meta}>Ожидается: {dateLabel(order.eta)} · версия {order.version}</p><TruthLabels axes={order.axes ?? api.data?.axes ?? api.data} /></div><div className={styles.rowAside}><strong>{amountLabel(order.total_cost, order.currency)}</strong><Link href={`/orders/${encodeURIComponent(order.id)}`}>Открыть заказ<ArrowUpRight size={14} /></Link></div></li>)}</ul> : !api.error && <div className={styles.empty}><EmptyState>{rows.length ? "У этого поставщика нет заказов." : "Заказов пока нет. Начните с расчёта потребности."}</EmptyState>{rows.length ? <Button onClick={() => setSupplier("")}>Все поставщики</Button> : <Link className={styles.actionLink} href="/replenishment">Рассчитать заказ</Link>}</div>}
  </div>;
}
