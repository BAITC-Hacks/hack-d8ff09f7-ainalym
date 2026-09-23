"use client";
import Link from "next/link";
import { Chip, TruthLabels, type TruthAxes } from "@/components/labels";
import { EmptyState, LoadError, Skeleton, useApi } from "@/components/shell";
import styles from "./world-console.module.css";
type RunResponse = { run: { id: string; state: string; started_at: string; actions_count: number; escalations_count: number }; actions: { id: string; summary_ru: string; rationale_ru?: string; code_1c?: string; result: string; axes?: TruthAxes }[]; axes?: TruthAxes };
export function WorldRun({ id }: { id: string }) {
  const api = useApi<RunResponse>(`/api/agent/runs/${encodeURIComponent(id)}`);
  return <div className={styles.page}><header className={styles.pageHead}><div><Link href="/world">← Консоль событий</Link><h1>Запуск агента</h1><p className={styles.meta}>{id}</p></div></header>
    {api.error && <LoadError message={api.error.message} retry={api.reload} />}
    {api.loading ? <Skeleton lines={5} /> : api.data && <><div><Chip tone={api.data.run.state === "failed" ? "danger" : "neutral"}>{({ running: "В работе", done: "Завершено", failed: "Ошибка" } as Record<string,string>)[api.data.run.state] ?? api.data.run.state}</Chip><p className={styles.subtitle}>Действий: {api.data.run.actions_count} · решений для вас: {api.data.run.escalations_count}</p></div><ol className={styles.events}>{api.data.actions.map(action => <li key={action.id} className={styles.event}><span className={styles.sequence}>{action.result === "failed" ? "!" : "✓"}</span><div className={styles.eventBody}><h2>{action.summary_ru}</h2>{action.rationale_ru && <p className={styles.eventText}>{action.rationale_ru}</p>}<TruthLabels axes={action.axes ?? api.data?.axes} /></div>{action.code_1c && <div className={styles.eventAction}><Link href={`/skus/${encodeURIComponent(action.code_1c)}`}>Открыть товар</Link></div>}</li>)}</ol>{!api.data.actions.length && <EmptyState>В этом запуске ещё нет записанных действий.</EmptyState>}</>}
  </div>;
}
