import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { EXPORT_LABEL } from "@/peers/onec_export";
import { activeOrg, feed, WorldError } from "@/world/feed";
import PeerActions from "./PeerActions";
import styles from "../peerPages.module.css";

export const dynamic = "force-dynamic";

export default function PeersPage() {
  try { activeOrg(); } catch (error) { if (error instanceof WorldError && error.status === 404) notFound(); throw error; }
  const events = feed({}).rows;
  const exports = db().prepare("SELECT p.external_identity,p.version,p.state,p.as_of,p.payload FROM ledger_peer_record p WHERE p.peer = 'onec_export' ORDER BY p.as_of DESC")
    .all() as { external_identity: string; version: number; state: string; as_of: string; payload: string }[];
  const orders = db().prepare("SELECT id,supplier_id,state,total_qty,version FROM purchase_order WHERE state IN ('approved','exported') ORDER BY id")
    .all() as { id: string; supplier_id: string; state: string; total_qty: number; version: number }[];
  return <main className={styles.main}>
    <div className={styles.topline}><div><p className={styles.eyebrow}>Локальный мир · подготовленные файлы</p><h1 className={styles.title}>Мир и экспорт</h1><p className={styles.subtitle}>События поступают в очередь агента. Утверждённые заказы можно выгрузить как файлы для 1С.</p></div><span className={styles.badge}>external: local_simulator / export_only</span></div>
    <section className={styles.panel} aria-labelledby="world-title">
      <h2 id="world-title">Лента событий</h2>
      <p className={styles.subtitle}>«Симулятор мира — синтетическое событие» на каждой строке. Запуск переводит следующий сценарный шаг в очередь.</p>
      <PeerActions kind="play" enabled={events.some((event) => event.state === "scripted")} />
      {events.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>№ / время</th><th>Событие</th><th>Объект</th><th>Состояние / запуск</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}>
        <td>{event.seq ?? "—"}<br /><small>{event.emitted_at ?? event.at ?? "Сценарий"}</small></td>
        <td><strong>{event.kind}</strong><br />{event.text || "—"}<br /><small>Симулятор мира — синтетическое событие</small></td>
        <td>{event.code_1c ? <Link className={styles.link} href={`/world/${encodeURIComponent(event.code_1c)}`}>{event.code_1c}</Link> : event.po_id ? <Link className={styles.link} href={`/supplier/${encodeURIComponent(event.po_id)}`}>{event.po_id}</Link> : "—"}</td>
        <td>{event.state}{event.run_id && <><br /><Link className={styles.link} href={`/api/agent/runs/${encodeURIComponent(event.run_id)}`}>Запуск {event.run_id}</Link></>}</td>
      </tr>)}</tbody></table></div> : <p className={styles.truth}>Событий пока нет. Сценарий появится после загрузки данных партнёра.</p>}
    </section>
    <section className={styles.panel} aria-labelledby="orders-title"><h2 id="orders-title">Заказы к экспорту</h2>
      {orders.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Заказ</th><th>Поставщик</th><th>Кол-во</th><th>Версия</th><th>Файл</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><Link className={styles.link} href={`/supplier/${encodeURIComponent(order.id)}`}>{order.id}</Link></td><td>{order.supplier_id}</td><td>{order.total_qty}</td><td>{order.version}</td><td><PeerActions kind="export" poId={order.id} exported={order.state === "exported"} /></td></tr>)}</tbody></table></div> : <p className={styles.truth}>Утверждённых заказов пока нет.</p>}
      <p className={styles.truth}>{EXPORT_LABEL} · external: export_only. Файл создаётся только после утверждения заказа.</p>
    </section>
    <section className={styles.panel} aria-labelledby="export-title"><h2 id="export-title">Реестр файлов</h2>
      {exports.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Заказ / identity</th><th>Состояние</th><th>Версия</th><th>as_of</th><th>Файл</th></tr></thead><tbody>{exports.map((record) => <tr key={record.external_identity}><td>{record.external_identity}<br /><small>{EXPORT_LABEL}</small></td><td>{record.state}</td><td>{record.version}</td><td>{record.as_of}</td><td><Link className={styles.link} href={`/api/peers/onec-export/${encodeURIComponent(record.external_identity)}?format=xlsx`}>XLSX</Link> · <Link className={styles.link} href={`/api/peers/onec-export/${encodeURIComponent(record.external_identity)}?format=csv`}>CSV</Link></td></tr>)}</tbody></table></div> : <p className={styles.truth}>Файлы ещё не подготовлены.</p>}
    </section>
  </main>;
}
