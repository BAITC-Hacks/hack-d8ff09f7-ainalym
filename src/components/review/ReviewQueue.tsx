"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Chip } from "@/components/labels";
import { LoadError, Skeleton, useApi } from "@/components/shell";
import { ResultLabels } from "@/components/purchase/ResultLabels";
import { date, money, number } from "@/components/purchase/types";
import { type Order, type QueueResponse } from "./types";
import styles from "@/components/purchase/workspace.module.css";
import review from "./review.module.css";

export function QueueContent({ data }: { data: QueueResponse }) {
  if (!data.items.length && data.empty_reason === "domain pending")
    return (
      <div className={styles.empty} role="status">
        <h2>Очередь ещё не готова</h2>
        <p className={styles.subtitle}>
          Решения появятся после подключения расчёта. Их отсутствие пока не
          означает, что всё проверено.
        </p>
      </div>
    );
  return data.items.length ? (
    <ul className={review.queue}>
      {data.items.map((item) => (
        <li key={item.id} className={review.queueRow}>
          <div className={review.queueMain}>
            <p className={styles.eyebrow}>
              {item.kind === "task" ? "Задача" : "Решение"} · {date(item.since)}
            </p>
            <h2>{item.title}</h2>
            <p className={styles.subtitle}>{item.why}</p>
          </div>
          <div className={review.queueMoney}>
            <strong>
              {item.money_at_stake
                ? money(item.money_at_stake)
                : "Сумма не определена"}
            </strong>
            <span className={styles.rowNote}>
              {number(item.sources?.length ?? 0, 0)} источников
            </span>
          </div>
          <Link
            className={styles.linkButton}
            href={
              item.href?.startsWith("/") && !item.href.startsWith("//")
                ? item.href
                : `/review/${encodeURIComponent(item.id)}`
            }
          >
            Проверить <ArrowRight size={16} />
          </Link>
        </li>
      ))}
    </ul>
  ) : (
    <div className={styles.empty}>
      <h2>Всё проверено</h2>
      <p className={styles.subtitle}>
        Новых решений нет. Следующий расчёт или событие появится здесь, когда
        понадобится ваше участие.
      </p>
      <Link href="/replenishment" className={styles.linkButton}>
        К пополнению
      </Link>
    </div>
  );
}
export function ReviewQueue() {
  const queue = useApi<QueueResponse>("/api/queue");
  const orders = useApi<{ orders: Order[] }>("/api/orders");
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>Решения</p>
          <h1>Проверка</h1>
          <p className={styles.subtitle}>
            Заказы поставщикам, разовые продажи и изменения параметров. Агент
            подготовил — решение за вами.
          </p>
        </div>
        {queue.data && (
          <Chip>{number(queue.data.items.length, 0)} ждут вас</Chip>
        )}
      </header>
      <section className={styles.panel} aria-label="Очередь решений">
        {queue.loading && !queue.data && (
          <div className={styles.panelBody}>
            <Skeleton lines={5} />
          </div>
        )}
        {queue.error && (
          <LoadError message={queue.error.message} retry={queue.reload} />
        )}
        {queue.data && <QueueContent data={queue.data} />}
      </section>
      {queue.data && <ResultLabels result={queue.data} />}
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>Заказы</h2>
          <p>Черновики и утверждённые составы</p>
        </div>
        {orders.loading && !orders.data && (
          <div className={styles.panelBody}>
            <Skeleton lines={2} />
          </div>
        )}
        {orders.error && (
          <LoadError message={orders.error.message} retry={orders.reload} />
        )}
        {orders.data &&
          (orders.data.orders.length ? (
            orders.data.orders.map((order) => (
              <Link
                key={order.id}
                className={review.orderLink}
                href={`/orders/${encodeURIComponent(order.id)}`}
              >
                <div>
                  <strong>
                    {order.supplier_id} · {number(order.total_qty)} шт.
                  </strong>
                  <p className={`${styles.rowNote} ${styles.code}`}>
                    {order.id} · ожидаем {date(order.eta)}
                  </p>
                </div>
                <div className={styles.actions}>
                  <strong>{money(order.total_cost, order.currency)}</strong>
                  <Chip>
                    {order.state === "draft"
                      ? "Черновик"
                      : order.state === "exported"
                        ? "Экспорт подготовлен"
                        : "Утверждён"}
                  </Chip>
                  <ArrowRight size={16} />
                </div>
              </Link>
            ))
          ) : (
            <div className={styles.empty}>
              Заказов пока нет. Они появятся после проверки рекомендаций.
            </div>
          ))}
      </section>
    </div>
  );
}
