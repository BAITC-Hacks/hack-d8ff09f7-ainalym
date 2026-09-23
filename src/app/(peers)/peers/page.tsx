import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { Chip, WorldLabel } from "@/components/labels";
import { EXPORT_LABEL } from "@/peers/onec_export";
import { activeOrg, feed, WorldError, type WorldRow } from "@/world/feed";
import PeerActions from "./PeerActions";
import styles from "../peerPages.module.css";

export const dynamic = "force-dynamic";

function eventSummary(event: WorldRow): string {
  if (event.text) return event.text;
  const p = event.payload;
  if (event.kind === "sales_day") return `${p.supplier_id ?? "Продажи"} · ${p.date ?? event.at?.slice(0, 10) ?? "день"} · ${Array.isArray(p.lines) ? p.lines.length : 0} строк`;
  if (event.kind === "stock_snapshot") return `Срез остатков · ${p.ym ?? ""} · ${Array.isArray(p.stocks) ? p.stocks.length : 0} товаров`;
  if (event.kind === "in_transit_update") return `Товар в пути · ${Array.isArray(p.rows) ? `${p.rows.length} позиций` : `${p.delta_qty ?? "?"} шт`}`;
  if (event.kind === "price_update") return `Новая цена · ${p.to ?? p.unit_cost ?? "—"} ${p.currency ?? "KZT"}`;
  return "Событие без текста";
}
function shortTime(value: string | null): string {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return match ? `${match[3]}.${match[2]}.${match[1]} · ${match[4]}:${match[5]}` : value ?? "Сценарий";
}
const eventStates: Record<string, string> = { scripted: "Готово к запуску", pending: "В очереди", processed: "Обработано", replayed: "Повтор", failed: "Ошибка" };
const eventKinds: Record<string, string> = { sales_day: "Продажи за день", stock_snapshot: "Остатки на складе",
  in_transit_update: "Товары в пути", price_update: "Изменение цены", judge_message: "Событие сценария",
  supplier_reply: "Ответ поставщика" };

export default function PeersPage() {
  try { activeOrg(); } catch (error) { if (error instanceof WorldError && error.status === 404) notFound(); throw error; }
  const events = feed({}).rows;
  const exports = db().prepare("SELECT p.external_identity,p.version,p.state,p.as_of,p.payload FROM ledger_peer_record p WHERE p.peer = 'onec_export' ORDER BY p.as_of DESC")
    .all() as { external_identity: string; version: number; state: string; as_of: string; payload: string }[];
  const orders = db().prepare("SELECT id,supplier_id,state,total_qty,version FROM purchase_order WHERE state IN ('approved','exported') ORDER BY id")
    .all() as { id: string; supplier_id: string; state: string; total_qty: number; version: number }[];
  return <main className={styles.main}>
    <div className={styles.topline}><div><p className={styles.eyebrow}>Локальный мир · подготовленные файлы</p><h1 className={styles.title}>Мир и экспорт</h1><p className={styles.subtitle}>События поступают в очередь агента. Утверждённые заказы можно выгрузить как файлы для 1С.</p></div><div className={styles.choiceRow}><Chip>Локальный симулятор</Chip><Chip>{EXPORT_LABEL}</Chip></div></div>
    <section className={styles.panel} aria-labelledby="world-title">
      <h2 id="world-title">Лента событий</h2>
      <p className={styles.subtitle}>«Симулятор мира — синтетическое событие» на каждой строке. Запуск переводит следующий сценарный шаг в очередь.</p>
      <PeerActions kind="play" enabled={events.some((event) => event.state === "scripted")} />
      {events.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>№ / время</th><th>Событие</th><th>Объект</th><th>Состояние / запуск</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}>
        <td>{event.seq ?? "—"}<br /><small>{shortTime(event.emitted_at ?? event.at)}</small></td>
        <td><strong>{eventKinds[event.kind] ?? "Событие"}</strong><br />{eventSummary(event)}<br /><WorldLabel /></td>
        <td>{event.code_1c ? <Link className={styles.link} href={`/world/${encodeURIComponent(event.code_1c)}`}>{event.code_1c}</Link> : event.po_id ? <Link className={styles.link} href={`/supplier/${encodeURIComponent(event.po_id)}`}>{event.po_id}</Link> : String(event.payload.supplier_id ?? (event.kind === "stock_snapshot" ? "Все SKU" : "—"))}</td>
        <td>{eventStates[event.state] ?? "Проверить состояние"}{event.run_id && <><br /><Link className={styles.link} href={`/api/agent/runs/${encodeURIComponent(event.run_id)}`}>Открыть запуск</Link></>}</td>
      </tr>)}</tbody></table></div> : <p className={styles.truth}>Событий пока нет. Сценарий появится после загрузки данных партнёра.</p>}
    </section>
    <section className={styles.panel} aria-labelledby="orders-title"><h2 id="orders-title">Заказы к экспорту</h2>
      {orders.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Заказ</th><th>Поставщик</th><th>Кол-во</th><th>Версия</th><th>Файл</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><Link className={styles.link} href={`/supplier/${encodeURIComponent(order.id)}`}>{order.id}</Link></td><td>{order.supplier_id}</td><td>{order.total_qty}</td><td>{order.version}</td><td><PeerActions kind="export" poId={order.id} exported={order.state === "exported"} /></td></tr>)}</tbody></table></div> : <p className={styles.truth}>Утверждённых заказов пока нет.</p>}
      <p className={styles.truth}><Chip>{EXPORT_LABEL}</Chip> Файл создаётся только после утверждения заказа.</p>
    </section>
    <section className={styles.panel} aria-labelledby="export-title"><h2 id="export-title">Реестр файлов</h2>
      {exports.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Заказ / identity</th><th>Состояние</th><th>Версия</th><th>as_of</th><th>Файл</th></tr></thead><tbody>{exports.map((record) => <tr key={record.external_identity}><td>{record.external_identity}<br /><Chip>{EXPORT_LABEL}</Chip></td><td>{record.state}</td><td>{record.version}</td><td>{record.as_of}</td><td><Link className={styles.link} href={`/api/peers/onec-export/${encodeURIComponent(record.external_identity)}?format=xlsx`}>XLSX</Link> · <Link className={styles.link} href={`/api/peers/onec-export/${encodeURIComponent(record.external_identity)}?format=csv`}>CSV</Link></td></tr>)}</tbody></table></div> : <p className={styles.truth}>Файлы ещё не подготовлены.</p>}
    </section>
  </main>;
}
