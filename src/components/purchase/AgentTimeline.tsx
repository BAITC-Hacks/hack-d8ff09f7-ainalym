"use client";
import { AgentsLabel, Chip } from "@/components/labels";
import { EmptyState, LoadError, Skeleton, useApi } from "@/components/shell";
import { date, sourceText, type AgentAction, type LedgerResponse } from "./types";
import styles from "./workspace.module.css";

const kinds: Record<string, string> = { recompute: "Пересчёт", outlier_flagged: "Разовый заказ", recommendation_prepared: "Рекомендация", order_drafted: "Заказ подготовлен", escalation: "Нужно решение", decision: "Решение", status_change: "Смена состояния", export_written: "Экспорт", obligation_updated: "Обязательства", noop: "Без изменений" };
export function TimelineRows({ rows }: { rows: AgentAction[] }) {
  if (!rows.length) return <EmptyState>Действий агента пока нет. Здесь появятся расчёты, решения и их основания.</EmptyState>;
  return <ol className={styles.timeline}>{rows.map(row => <li className={styles.event} key={row.id}>
    <div className={styles.eventMeta}><span>{kinds[row.kind] ?? row.kind}</span><time dateTime={row.at}>{date(row.at)}</time><Chip tone={row.autonomy === "escalated" ? "warning" : "neutral"}>{row.autonomy === "auto" ? "Самостоятельно" : "На ваше решение"}</Chip>{row.result === "failed" && <Chip tone="danger">Ошибка</Chip>}</div>
    <p><strong>{row.summary_ru}</strong></p>
    <details className={styles.disclosure}><summary>Почему · источники</summary><div className={styles.stack}><p>{row.rationale_ru || "Обоснование не указано в записи агента."}</p>{row.sources?.length ? <ul className={styles.sources}>{row.sources.map((source, i) => <li key={i}>{sourceText(source)}</li>)}</ul> : <p className={styles.rowNote}>Источники не указаны.</p>}{row.provider && <p className={styles.rowNote}>{row.provider}{row.model_version ? ` · ${row.model_version}` : ""}</p>}</div></details>
  </li>)}</ol>;
}
export function AgentTimeline({ code, po }: { code?: string; po?: string }) {
  const query = new URLSearchParams({ limit: "12", ...(code ? { code } : {}), ...(po ? { po } : {}) });
  const api = useApi<LedgerResponse>(`/api/agent/ledger?${query}`);
  return <section className={styles.panel} aria-labelledby="agent-timeline"><div className={styles.panelHead}><h2 id="agent-timeline">Действия агента</h2><AgentsLabel /></div><div className={styles.panelBody}>
    {api.loading && !api.data ? <Skeleton lines={4} /> : null}
    {api.error && <LoadError message={api.error.message} retry={api.reload} />}
    {api.data && <TimelineRows rows={api.data.rows ?? api.data.actions ?? []} />}
  </div></section>;
}
