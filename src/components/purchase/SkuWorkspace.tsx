"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Chip, UrgencyChip } from "@/components/labels";
import { Button, LoadError, Skeleton, useApi } from "@/components/shell";
import { AssistantPanel } from "@/components/assistant";
import { AgentTimeline } from "./AgentTimeline";
import { DemandChart } from "./DemandChart";
import { Rationale } from "./Rationale";
import { QuantityEditor } from "./QuantityEditor";
import { ResultLabels } from "./ResultLabels";
import { date, money, number, parseJson, type SkuResponse } from "./types";
import { useState } from "react";
import styles from "./workspace.module.css";

export function SkuWorkspace({ code }: { code: string }) {
  const api = useApi<SkuResponse>(`/api/skus/${encodeURIComponent(code)}`);
  const [editing, setEditing] = useState(false);
  const [assistant, setAssistant] = useState(false);
  const data = api.data;
  const row = data?.recommendation
    ? {
        ...data.recommendation,
        components: parseJson(data.recommendation.components, {}),
      }
    : null;
  const components = row?.components ?? {};
  const latestStock = data?.series?.at(-1);
  const transitKnown = data?.in_transit?.every(
    (item) => item.qty != null && Number.isFinite(Number(item.qty)),
  );
  const onHand = row?.on_hand ?? latestStock?.stock;
  const inTransit =
    row?.in_transit ??
    (transitKnown
      ? data?.in_transit.reduce((sum, item) => sum + Number(item.qty), 0)
      : null);
  const chartSeries = (data?.series ?? []).map((point) => ({
    ...point,
    outliers: point.outliers?.length
      ? point.outliers
      : (components.outliers_excluded ?? []).filter(
          (doc) => (doc.ym ?? doc.at?.slice(0, 7)) === point.ym,
        ),
  }));
  return (
    <div className={styles.page}>
      <Link
        href="/replenishment"
        className={styles.linkButton}
        style={{ justifySelf: "start" }}
      >
        <ArrowLeft size={16} />К пополнению
      </Link>
      {api.error && (
        <LoadError
          message={
            api.error.status === 404
              ? "Товар не найден или его данные ещё не загружены."
              : api.error.message
          }
          retry={api.reload}
        />
      )}
      {api.loading && !data && <Skeleton lines={8} />}
      {data?.sku && (
        <>
          <header className={styles.header}>
            <div className={styles.heading}>
              <p className={styles.eyebrow}>
                {data.sku.supplier_id} · Код 1с {data.sku.code_1c}
              </p>
              <h1>{data.sku.name}</h1>
              <div className={styles.actions}>
                {data.sku.article && <Chip>Артикул {data.sku.article}</Chip>}
                {row && <UrgencyChip urgency={row.urgency} />}
              </div>
            </div>
          </header>
          <ResultLabels result={data} />
          <dl className={styles.metrics}>
            <div className={styles.metric}>
              <dt>На складе</dt>
              <dd>{number(onHand)}</dd>
              <small>
                шт. ·{" "}
                {row
                  ? `на ${components.stock_month ?? "момент расчёта"}`
                  : (latestStock?.ym ?? "дата не указана")}
              </small>
            </div>
            <div className={styles.metric}>
              <dt>В пути</dt>
              <dd>{number(inTransit)}</dd>
              <small>
                шт. ·{" "}
                {row ? "учтено в потребности" : "зарегистрированные поставки"}
              </small>
            </div>
            <div className={styles.metric}>
              <dt>
                Прогноз
                {components.horizon_days
                  ? ` · ${number(components.horizon_days, 0)} дн.`
                  : ""}
              </dt>
              <dd>
                {row
                  ? number(row.forecast_qty ?? components.forecast_qty)
                  : "Нет расчёта"}
              </dd>
              <small>шт. · сезонность и рост</small>
            </div>
            <div className={styles.metric}>
              <dt>Рекомендовано</dt>
              <dd>{row ? number(row.qty_recommended) : "Нет расчёта"}</dd>
              <small>
                {row?.qty_adjusted != null
                  ? `Ваше количество: ${number(row.qty_adjusted)} шт.`
                  : `Кратность ${number(data.sku.moq)} шт.`}
              </small>
            </div>
          </dl>
          <div className={styles.split} data-assistant={assistant}>
            <div className={styles.stack}>
              <section className={styles.panel}>
                <div className={styles.panelHead}>
                  <h2>Спрос и прогноз</h2>
                  <p>Последние 36 месяцев · шт.</p>
                </div>
                <div className={styles.panelBody}>
                  <DemandChart
                    series={chartSeries}
                    forecast={
                      components.monthly_forecast ??
                      data.forecast?.monthly_forecast
                    }
                  />
                  {data.forecast?.method_ru && (
                    <p className={styles.notice}>{data.forecast.method_ru}</p>
                  )}
                </div>
              </section>
              <section className={styles.panel}>
                <div className={styles.panelHead}>
                  <h2>Почему столько</h2>
                  {row &&
                    (!row.state ||
                      ["proposed", "adjusted"].includes(row.state)) && (
                      <Button
                        onClick={() => setEditing((v) => !v)}
                        aria-expanded={editing}
                      >
                        Изменить количество
                      </Button>
                    )}
                </div>
                {row ? (
                  <>
                    <Rationale row={row} />
                    {editing && (
                      <QuantityEditor
                        row={row}
                        onClose={() => setEditing(false)}
                      />
                    )}
                  </>
                ) : (
                  <div className={styles.empty}>
                    <p>Для этого товара ещё нет расчёта.</p>
                    <Link className={styles.linkButton} href="/replenishment">
                      Перейти к расчёту
                    </Link>
                  </div>
                )}
              </section>
              <AgentTimeline code={code} />
            </div>
            <aside className={styles.stack} aria-label="Факты и помощник">
              <Button
                id="sku-assistant-toggle"
                onClick={() => setAssistant((value) => !value)}
                aria-expanded={assistant}
              >
                {assistant ? "Показать факты" : "Помощник по этому товару"}
              </Button>
              {assistant ? (
                <AssistantPanel
                  scope={{
                    org_id: "partner",
                    supplier_id: data.sku.supplier_id,
                    code_1c: code,
                  }}
                  onClose={() => {
                    setAssistant(false);
                    document.getElementById("sku-assistant-toggle")?.focus();
                  }}
                />
              ) : (
                <>
                  <section className={styles.panel}>
                    <div className={styles.panelBody}>
                      <h2>Экономика</h2>
                      <dl className={styles.facts}>
                        <div>
                          <dt>Поставщик</dt>
                          <dd>{data.sku.supplier_id}</dd>
                        </div>
                        <div>
                          <dt>Себестоимость</dt>
                          <dd>{money(data.sku.unit_cost)}</dd>
                        </div>
                        <div>
                          <dt>Единица</dt>
                          <dd>{data.sku.unit ?? "Не указана"}</dd>
                        </div>
                        <div>
                          <dt>Покрытие</dt>
                          <dd>{number(components.days_of_cover)} дн.</dd>
                        </div>
                      </dl>
                      {data.sku.unit_cost == null && (
                        <p className={styles.rowNote}>
                          Неизвестная цена не приравнивается к нулю.
                        </p>
                      )}
                    </div>
                  </section>
                  <section className={styles.panel}>
                    <div className={styles.panelBody}>
                      <h2>Поставки в пути</h2>
                      {data.in_transit?.length ? (
                        <dl className={styles.facts}>
                          {data.in_transit.map((item, i) => (
                            <div key={item.id ?? `${item.po_ref}-${i}`}>
                              <dt>
                                {item.po_ref}
                                <p className={styles.rowNote}>
                                  {date(item.expected_at)}
                                </p>
                              </dt>
                              <dd>{number(item.qty)} шт.</dd>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <p className={styles.subtitle}>
                          Поставок в пути не зарегистрировано.
                        </p>
                      )}
                    </div>
                  </section>
                </>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
