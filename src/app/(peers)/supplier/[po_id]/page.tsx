import Link from "next/link";
import { notFound } from "next/navigation";
import { supplierChannel } from "@/peers/supplier";
import { WorldError } from "@/world/feed";
import SupplierActions from "./SupplierActions";
import styles from "../../peerPages.module.css";

export const dynamic = "force-dynamic";

export default async function SupplierPage({ params }: { params: Promise<{ po_id: string }> }) {
  const { po_id } = await params;
  let data: ReturnType<typeof supplierChannel>;
  try { data = supplierChannel(po_id); } catch (error) { if (error instanceof WorldError && error.status === 404) notFound(); throw error; }
  const { order, lines, channel } = data;
  return <main className={styles.main}>
    <div className={styles.topline}>
      <div><p className={styles.eyebrow}>Демо-канал поставщика · {order.supplier_id}</p><h1 className={styles.title}>Заказ {order.id}</h1><p className={styles.subtitle}>Подготовленное письмо поставщику. Передача за пределы приложения не выполняется.</p></div>
      <Link className={styles.link} href="/peers">Мир и экспорт</Link>
    </div>
    <span className={styles.badge}>{channel.label}</span>
    <section className={styles.panel} aria-labelledby="letter-title">
      <h2 id="letter-title">Письмо для {order.supplier_name}</h2>
      <div className={styles.meta}><span>Кому: {order.supplier_name}</span><span>Тема: Заказ на пополнение {order.id}</span>{order.eta && <span>Ожидаемая дата: {order.eta}</span>}</div>
      <p className={styles.body}>Здравствуйте! Просим подтвердить получение подготовленного заказа {order.id} на {order.total_qty} шт. Перечень позиций ниже.</p>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Код 1С</th><th>Артикул</th><th>Наименование</th><th>Кол-во</th></tr></thead><tbody>
        {lines.map((line) => <tr key={line.code_1c}><td>{line.code_1c}</td><td>{line.article ?? "—"}</td><td>{line.name}</td><td>{line.qty}</td></tr>)}
      </tbody></table></div>
      <p className={styles.truth}>Черновик заказа — не отправлен до явного действия в контролируемом демо-канале.</p>
    </section>
    <section className={styles.panel} aria-labelledby="reply-title"><h2 id="reply-title">Ответ поставщика</h2><SupplierActions poId={po_id} orderState={order.state} channel={channel} /></section>
  </main>;
}
