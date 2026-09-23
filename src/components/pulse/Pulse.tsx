"use client";
import { useApi, LoadError, type ModesResponse } from "@/components/shell";
import { TruthAxisLabels } from "@/components/labels";
import { DueStrip } from "./DueStrip";
import { MoneyStrip } from "./MoneyStrip";
import { DecisionQueue } from "./DecisionQueue";
import { CalculationComposer } from "./CalculationComposer";
import { Commitments } from "./Commitments";
import { AgentLedger } from "./AgentLedger";
import { WorldFeed } from "@/components/feed/WorldFeed";
import type { TodayResponse, QueueResponse, LedgerResponse } from "./types";
import styles from "./pulse.module.css";
export function Pulse({ initial, initialQueue, initialLedger, initialModes, date }: { initial?: TodayResponse; initialQueue?: QueueResponse; initialLedger?: LedgerResponse; initialModes?: ModesResponse; date: string }) {
  const today = useApi<TodayResponse>("/api/today", initial); const queue = useApi<QueueResponse>("/api/queue", initialQueue); const ledger = useApi<LedgerResponse>("/api/agent/ledger?limit=8", initialLedger); const modes = useApi<ModesResponse>("/api/modes", initialModes);
  const data = today.data; const axes = data?.axes ?? data?.labels ?? modes.data?.axes ?? modes.data;
  return <div className={styles.pulse}><header className={styles.pageHead}><div className={styles.pageIdentity}><span className={styles.eyebrow}>Пульс компании</span><h1>Сегодня</h1></div><time className={styles.date}>{date}</time></header>
    <MoneyStrip money={data?.pulse?.money} risk={data?.pulse?.stockout_risk} loading={today.loading} />
    {today.error && <LoadError message={data ? "Не удалось обновить пульс — показываю последнее известное." : today.error.message} retry={today.reload} />}
    <p className={styles.lead}>{data?.lead || (today.loading ? "Загружаем состояние закупок…" : today.error ? "Состояние закупок пока недоступно." : "Каждый заказ начинается с обоснованного расчёта.")}</p>
    <div className={styles.columns}><div className={styles.mainColumn}>
      <DecisionQueue {...queue} axes={axes} />
      <DueStrip money={data?.pulse?.money} />
      <CalculationComposer />
      <WorldFeed axes={axes} />
      <Commitments rows={data?.commitments} loading={today.loading} />
      {data && <div className={styles.pageTruth}><TruthAxisLabels axes={axes} /></div>}
    </div><AgentLedger {...ledger} axes={axes} background={data?.background} /></div>
  </div>;
}
