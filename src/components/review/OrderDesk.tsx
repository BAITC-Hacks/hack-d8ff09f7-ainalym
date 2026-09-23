"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Check, Download, FileText } from "lucide-react";
import { Chip } from "@/components/labels";
import {
  ActionStatus,
  ApiError,
  Button,
  LoadError,
  Skeleton,
  apiRequest,
  useApi,
  useApiAction,
} from "@/components/shell";
import { AgentTimeline } from "@/components/purchase/AgentTimeline";
import { ResultLabels } from "@/components/purchase/ResultLabels";
import { usePageKeys } from "@/components/purchase/usePageKeys";
import {
  date,
  money,
  number,
  type ResultAxes,
} from "@/components/purchase/types";
import { type Artifact, type Order, type OrderResponse } from "./types";
import styles from "@/components/purchase/workspace.module.css";
import review from "./review.module.css";

export function ArtifactPreview({ artifact }: { artifact: Artifact }) {
  return (
    <section className={styles.panel} aria-label="Предпросмотр письма">
      <div className={styles.panelHead}>
        <h2>{artifact.title_ru}</h2>
        <Chip>Черновик заказа — не отправлен</Chip>
      </div>
      <div className={styles.panelBody}>
        <pre className={review.artifact}>{artifact.markdown}</pre>
        <ResultLabels
          result={{
            ...artifact,
            ai: artifact.provider === "openai" ? "live" : artifact.ai,
          }}
        />
        <p className={styles.rowNote}>
          {date(artifact.created_at)}
          {artifact.model_version ? ` · ${artifact.model_version}` : ""}
        </p>
        <a
          className={styles.linkButton}
          href={`/api/artifacts/${encodeURIComponent(artifact.id)}/download`}
          download
        >
          <Download size={16} />
          Скачать черновик
        </a>
      </div>
    </section>
  );
}
export function OrderContent({
  order,
  result,
}: {
  order: Order;
  result?: ResultAxes;
}) {
  const [version, setVersion] = useState(order.version);
  const [acknowledgedVersion, setAcknowledgedVersion] = useState<number | null>(
    null,
  );
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const approve = useApiAction(),
    draft = useApiAction(),
    exporting = useApiAction();
  const stale =
    version !== order.version ||
    (approve.error?.status === 409 && acknowledgedVersion !== order.version);
  const approved = order.state === "approved" || order.state === "exported";
  async function prepare() {
    const result = await draft.run(
      () =>
        apiRequest<{ artifact: Artifact }>("/api/drafts", {
          method: "POST",
          body: JSON.stringify({ kind: "supplier_email", po_id: order.id }),
        }),
      "Черновик подготовлен. Письмо не отправлено.",
    );
    if (result) setArtifact(result.artifact);
  }
  async function download(format: "csv" | "xlsx") {
    await exporting.run(async () => {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(order.id)}/export.${format}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new ApiError(
          response.status,
          body?.code ?? "export_unavailable",
          body?.message ??
            "Экспорт пока недоступен. Заказ сохранён — попробуйте ещё раз.",
        );
      }
      const file = await response.blob();
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${order.id}.${format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "Файл экспорта подготовлен к скачиванию.");
  }
  return (
    <>
      <dl className={styles.metrics}>
        <div className={styles.metric}>
          <dt>Позиций</dt>
          <dd>{number(order.lines.length, 0)}</dd>
          <small>{number(order.total_qty)} шт. в заказе</small>
        </div>
        <div className={styles.metric}>
          <dt>Стоимость заказа</dt>
          <dd style={{ font: "var(--t-lead)" }}>
            {money(order.total_cost, order.currency)}
          </dd>
          <small>
            Известна для {number(order.cost_known_lines, 0)} из{" "}
            {number(order.lines.length, 0)} позиций
          </small>
        </div>
        <div className={styles.metric}>
          <dt>Ожидаемая поставка</dt>
          <dd style={{ font: "var(--t-lead)" }}>{date(order.eta)}</dd>
          <small>Плановый срок</small>
        </div>
        <div className={styles.metric}>
          <dt>Версия</dt>
          <dd>{order.version}</dd>
          <small>
            {order.state === "draft"
              ? "Требует вашего утверждения"
              : "Сохранена сервером"}
          </small>
        </div>
      </dl>
      {approved && (
        <p className={styles.notice}>
          <Check size={16} aria-hidden="true" /> Заказ утверждён · версия{" "}
          {order.version}.{" "}
          {order.state === "exported"
            ? "Экспорт подготовлен."
            : "Можно подготовить экспорт и письмо."}{" "}
          Письмо поставщику не отправлено.
        </p>
      )}
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>Состав заказа</h2>
          <p>Поставщик {order.supplier_id}</p>
        </div>
        {order.lines.length ? (
          <table className={`${styles.table} ${styles.mobileCards}`}>
            <thead>
              <tr>
                <th scope="col">Код 1с</th>
                <th scope="col">Наименование</th>
                <th scope="col">Количество</th>
                <th scope="col">Себестоимость / шт.</th>
                <th scope="col">Обоснование</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => (
                <tr key={line.id ?? line.code_1c}>
                  <td data-label="Код 1с">
                    <Link
                      className={styles.itemTitle}
                      href={`/skus/${encodeURIComponent(line.code_1c)}`}
                    >
                      {line.code_1c}
                    </Link>
                  </td>
                  <td data-label="Наименование" className={styles.name}>
                    {line.name ?? line.code_1c}
                    {line.article && (
                      <p className={styles.rowNote}>Арт. {line.article}</p>
                    )}
                  </td>
                  <td data-label="Количество">
                    <strong>{number(line.qty)} шт.</strong>
                    <p className={styles.rowNote}>
                      Кратность {number(line.moq)}
                    </p>
                  </td>
                  <td data-label="Себестоимость">
                    {money(line.unit_cost, order.currency)}
                  </td>
                  <td data-label="Обоснование">
                    <details className={styles.disclosure}>
                      <summary>Почему</summary>
                      <p>{line.rationale_ru || "Обоснование не указано."}</p>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={styles.empty}>Позиции заказа ещё не подготовлены.</p>
        )}
      </section>
      <div className={styles.split}>
        <section className={styles.panel}>
          <div className={styles.panelBody}>
            <h2>Подготовленные документы</h2>
            <p className={styles.subtitle}>
              Экспорт содержит коды 1с, количество и обоснование каждой позиции.
              Письмо можно просмотреть до любого внешнего действия.
            </p>
            {approved ? (
              <>
                <div className={styles.actions}>
                  <Button
                    data-page-key="e"
                    aria-keyshortcuts="E"
                    title="E — перейти к экспорту"
                    onClick={() => download("xlsx")}
                    busy={exporting.busy}
                    disabled={exporting.busy}
                  >
                    <Download size={16} />
                    Экспорт для 1С · XLSX
                  </Button>
                  <Button
                    onClick={() => download("csv")}
                    disabled={exporting.busy}
                  >
                    CSV
                  </Button>
                  <Button
                    onClick={prepare}
                    busy={draft.busy}
                    disabled={draft.busy}
                  >
                    <FileText size={16} />
                    Черновик письма поставщику
                  </Button>
                </div>
                <ActionStatus
                  error={exporting.error}
                  receipt={exporting.receipt}
                />
                <ActionStatus error={draft.error} receipt={draft.receipt} />
              </>
            ) : (
              <p className={styles.notice}>
                Экспорт и письмо доступны после утверждения заказа.
              </p>
            )}
          </div>
        </section>
        <section className={styles.panel}>
          <div className={styles.panelBody}>
            <h2>Последствия утверждения</h2>
            <p>
              Сервер зафиксирует этот состав заказа и создаст обязательства по
              условиям поставщика.
            </p>
            {order.cost_known_lines < order.lines.length && (
              <p className={`${styles.notice} ${styles.warning}`}>
                Не для всех позиций известна себестоимость. Полная сумма
                обязательств остаётся неопределённой.
              </p>
            )}
            <Link className={styles.linkButton} href="/money">
              Посмотреть обязательства
            </Link>
          </div>
        </section>
      </div>
      {artifact && <ArtifactPreview artifact={artifact} />}
      <AgentTimeline po={order.id} />
      <footer className={review.footer}>
        {stale && !approved && (
          <div className={`${styles.notice} ${styles.warning}`} role="alert">
            Заказ изменился. Утверждение версии {version} не выполнено. Сверьте
            состав и сумму.
            {version !== order.version && (
              <Button
                onClick={() => {
                  setVersion(order.version);
                  setAcknowledgedVersion(order.version);
                }}
              >
                Проверено · использовать версию {order.version}
              </Button>
            )}
          </div>
        )}
        <ActionStatus error={approve.error} receipt={approve.receipt} />
        <div className={review.footerRow}>
          <div>
            <ResultLabels result={result} />
            <p className={review.footerMeta}>
              Утверждается версия {version} · поставщику ничего не отправляется
            </p>
          </div>
          {approved ? (
            <Link href="/review" className={styles.linkButton}>
              К очереди
            </Link>
          ) : (
            <Button
              data-page-key="d"
              aria-keyshortcuts="D"
              title="D — перейти к решению; Enter — утвердить"
              variant="primary"
              busy={approve.busy}
              disabled={approve.busy || stale || !order.lines.length}
              onClick={() =>
                approve.run(
                  () =>
                    apiRequest(
                      `/api/orders/${encodeURIComponent(order.id)}/approve`,
                      { method: "POST", body: JSON.stringify({ version }) },
                    ),
                  `Заказ утверждён по версии ${version}.`,
                )
              }
            >
              Утвердить заказ
            </Button>
          )}
        </div>
      </footer>
    </>
  );
}
export function OrderDesk({ id }: { id: string }) {
  usePageKeys();
  const api = useApi<OrderResponse>(`/api/orders/${encodeURIComponent(id)}`);
  return (
    <div className={styles.page}>
      <Link
        className={styles.linkButton}
        href="/review"
        style={{ justifySelf: "start" }}
      >
        <ArrowLeft size={16} />К проверке
      </Link>
      <header className={styles.header}>
        <div className={styles.heading}>
          <p className={`${styles.eyebrow} ${styles.code}`}>{id}</p>
          <h1>Заказ {api.data?.order.supplier_id ?? "поставщику"}</h1>
          <p className={styles.subtitle}>
            Состав, экономика и документы поставки
          </p>
        </div>
        {api.data && (
          <Chip>
            {api.data.order.state === "draft"
              ? "Черновик заказа — не отправлен"
              : api.data.order.state === "exported"
                ? "Экспорт для 1С (файл)"
                : "Утверждён"}
          </Chip>
        )}
      </header>
      {api.loading && !api.data && <Skeleton lines={8} />}
      {api.error && (
        <LoadError
          message={
            api.error.status === 404
              ? "Заказ не найден. Откройте актуальную очередь проверки."
              : api.error.message
          }
          retry={api.reload}
        />
      )}
      {api.data?.order && (
        <OrderContent key={id} order={api.data.order} result={api.data} />
      )}
    </div>
  );
}
