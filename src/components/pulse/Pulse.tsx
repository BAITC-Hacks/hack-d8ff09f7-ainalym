"use client";
import { useApi, LoadError } from "@/components/shell";
import { TruthAxisLabels, resultAxes } from "@/components/labels";
import { DueStrip } from "./DueStrip";
import { MoneyStrip } from "./MoneyStrip";
import { DecisionQueue } from "./DecisionQueue";
import { CalculationComposer } from "./CalculationComposer";
import { Commitments } from "./Commitments";
import { AgentLedger } from "./AgentLedger";
import { WorldFeed } from "@/components/feed/WorldFeed";
import type { TodayResponse, QueueResponse, LedgerResponse } from "./types";
import styles from "./pulse.module.css";
export function Pulse({ initial, initialQueue, initialLedger, date }: { initial?: TodayResponse; initialQueue?: QueueResponse; initialLedger?: LedgerResponse; date: string }) {
  const today = useApi<TodayResponse>("/api/today", initial); const queue = useApi<QueueResponse>("/api/queue", initialQueue); const ledger = useApi<LedgerResponse>("/api/agent/ledger?limit=8", initialLedger);
  const data = today.data; const axes = resultAxes(data);
  return <div className={styles.pulse}><header className={styles.pageHead}><div className={styles.pageIdentity}><span className={styles.eyebrow}>Пульс компании</span><h1>Сегодня</h1></div><time className={styles.date}>{date}</time></header>
    <MoneyStrip money={data?.pulse?.money} risk={data?.pulse?.stockout_risk} loading={today.loading} />
    {today.error && <LoadError message={data ? "Не удалось обновить пульс — показываю последнее известное." : today.error.message} retry={today.reload} />}
    <p className={styles.lead}>{data?.lead || (today.loading ? "Загружаем состояние закупок…" : today.error ? "Состояние закупок пока недоступно." : "Каждый заказ начинается с обоснованного расчёта.")}</p>
    <div className={styles.columns}><div className={styles.mainColumn}>
      <DecisionQueue {...queue} />
      <DueStrip money={data?.pulse?.money} />
      <CalculationComposer />
      <WorldFeed />
      <Commitments rows={data?.commitments} loading={today.loading} />
      {data && <div className={styles.pageTruth}><TruthAxisLabels axes={axes} /></div>}
    </div><AgentLedger {...ledger} background={data?.background} /></div>
  </div>;
}
