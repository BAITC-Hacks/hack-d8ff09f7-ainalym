"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, FileText, Bot, CircleAlert, RefreshCw } from "lucide-react";
import { ApiError, apiRequest, useApi, useApiSync } from "@/components/shell/api";
import { Button, Pill, Skeleton, StateBlock, TruthStrip, UrgencyPill, errorKind, errorTitle, fmtInt, fmtMoney, fmtNum, type Money, type Urgency } from "@/components/v2/primitives";
import { useTodaySnapshot } from "@/components/v2/Shell";
import { humanize, orderStateLabel, roleLabel } from "@/components/labels";
import styles from "./today.module.css";

type Decision = { id: string; kind: string; title: string; why: string; sources: string[]; money_at_stake?: Money | null; options: { key: string; label: string; effect: string }[]; href: string; since: string };
type Today = {
  ai: string; external: string; state_version: number; lead: string; decision: Decision | null; queue_count: number; empty_reason?: string;
  pulse: { money: { stock_value?: { amount: string; currency: string; cost_known_share: number; cost_unknown_count: number } | null; risks?: { code: string; count: number; label_ru: string }[] }; stockout_risk: { count: number; top: { code_1c: string; name: string; days_of_cover: number; lead_time_days: number; urgency: Urgency }[] }; agents: { auto: number; needs_you: number; ratio: number } };
  commitments: { id: string; kind: string; title: string; next_event: string | null; owner: string; state: string }[];
  background: { id: string; summary_ru: string; at: string }[];
};
type Queue = { items: Decision[]; empty_reason?: string };
type Proposal = { proposal: { id: string; version: number; state: string; subject_id: string } };

const time = (iso: string) => new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
const today = new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });

export default function TodayPage() {
  const t = useTodaySnapshot<Today>();
  const q = useApi<Queue>("/api/queue");
  const d = t.data;
  return (
    <div className={styles.page}>
      <p className={styles.eyebrow}>Сегодня · {today}</p>
      <div className={styles.head}>
        <h1 className={styles.display}>Сегодня</h1>
        <div className={styles.headActions}><Button variant="secondary" onClick={() => { t.reload(); q.reload(); }}><RefreshCw size={14} aria-hidden="true" />Обновить</Button><Link href="/replenishment" className={styles.primaryLink}>Пополнение<ArrowRight size={15} aria-hidden="true" /></Link></div>
      </div>
      {d && <p className={styles.lead}>{d.lead}</p>}

      {t.loading && !d && <div className={`v2-priority-card ${styles.strip}`} aria-busy="true">{[0, 1, 2, 3].map(i => <div key={i} className={styles.tile}><Skeleton rows={2} height={i ? 14 : 30} /></div>)}</div>}
      {t.error && !d && <StateBlock kind={errorKind(t.error)} title={errorTitle(t.error)} detail={t.error.message} action={<Button onClick={t.reload}>Повторить</Button>} />}
      {d && <Pulse d={d} stale={!!t.error} />}

      <div className={styles.columns}>
        <section className={styles.decisions} aria-labelledby="dec-h">
          <div className={styles.sectionHead}><h2 id="dec-h">Требует вашего решения</h2>{q.data && <span className={styles.sectionCount}>{q.data.items.length}</span>}</div>
          {q.loading && !q.data && <div className={styles.card}><Skeleton rows={3} /></div>}
          {q.error && !q.data && <StateBlock kind={errorKind(q.error)} title={errorTitle(q.error)} detail={q.error.message} action={<Button onClick={q.reload}>Повторить</Button>} />}
          {q.data && q.data.items.length === 0 && <StateBlock kind="empty" title="Решений нет — агенты работают" detail={q.data.empty_reason ?? d?.empty_reason ?? "Новые предложения появятся после следующего расчёта или события мира."} />}
          {q.data?.items.map(item => item.kind === "proposal" ? <DecisionCard key={item.id} item={item} onDone={() => { t.reload(); q.reload(); }} /> : <TaskCard key={item.id} item={item} />)}
        </section>
        <aside className={styles.rail}>
          {d && <>
            <section className={styles.railBlock} aria-labelledby="risk-h">
              <div className={styles.sectionHead}><h2 id="risk-h" className={styles.h3}>Риск дефицита</h2><Link href="/replenishment?urgency=critical" className={styles.more}>Все {fmtInt(d.pulse.stockout_risk.count)} <ArrowRight size={13} aria-hidden="true" /></Link></div>
              <ul className={styles.list}>
                {d.pulse.stockout_risk.top.map(s => (
                  <li key={s.code_1c} className={styles.listRow}>
                    <Link href={`/skus/${encodeURIComponent(s.code_1c)}`} prefetch={false} className={styles.rowMain}><span className={styles.rowTitle}>{s.name.replace(/\s+/g, " ")}</span><span className={styles.rowMeta}>{s.code_1c} · срок поставки {s.lead_time_days} дн</span></Link>
                    <span className={styles.rowRight} title={`Покрытие ${fmtNum(s.days_of_cover)} дн при сроке поставки ${s.lead_time_days} дн`}><span className={`${styles.days} ${s.days_of_cover < 0 ? styles.neg : ""}`}>{s.days_of_cover < 0 ? "нет остатка" : `${fmtNum(s.days_of_cover, 0)} дн`}</span><UrgencyPill value={s.urgency} /></span>
                  </li>
                ))}
                {d.pulse.stockout_risk.top.length === 0 && <li className={styles.emptyRow}>Дефицита не ожидается</li>}
              </ul>
            </section>
            <section className={styles.railBlock} aria-labelledby="bg-h">
              <div className={styles.sectionHead}><h2 id="bg-h" className={styles.h3}>Агенты в фоне</h2><Pill tone="neutral"><Bot size={12} aria-hidden="true" />Агенты · данные партнёра</Pill></div>
              <ul className={styles.list}>
                {d.background.slice(0, 5).map(b => <li key={b.id} className={styles.listRow}><span className={styles.rowMain}><span className={styles.rowTitleSm}>{humanize(b.summary_ru)}</span></span><time className={styles.rowTime} dateTime={b.at}>{time(b.at)}</time></li>)}
                {d.background.length === 0 && <li className={styles.emptyRow}>Пока ничего — расчёт не запускался</li>}
              </ul>
            </section>
            <section className={styles.railBlock} aria-labelledby="cm-h">
              <h2 id="cm-h" className={styles.h3}>Обязательства и расчёты</h2>
              <ul className={styles.list}>
                {d.commitments.map(c => <li key={c.id} className={styles.listRow}><span className={styles.rowMain}><span className={styles.rowTitleSm}>{humanize(c.title)}</span><span className={styles.rowMeta}>{roleLabel(c.owner)} · {c.next_event ? time(c.next_event) : "—"}</span></span><Pill tone={c.state === "done" ? "ok" : c.state === "draft" ? "neutral" : "warn"}>{orderStateLabel(c.state)}</Pill></li>)}
                {d.commitments.length === 0 && <li className={styles.emptyRow}>Обязательств нет — заказы не утверждались</li>}
              </ul>
            </section>
          </>}
        </aside>
      </div>
      <footer className={styles.foot}><TruthStrip ai={d?.ai} external={d?.external} /></footer>
    </div>
  );
}

function Pulse({ d, stale }: { d: Today; stale: boolean }) {
  const sv = d.pulse.money.stock_value ?? null;
  const share = sv ? Math.round(sv.cost_known_share * 100) : null;
  const ratio = Math.round(d.pulse.agents.ratio * 1000) / 10;
  const risks = d.pulse.money.risks ?? [];
  return (
    <section className={`v2-priority-card ${styles.strip}`} aria-label="Пульс" data-stale={stale || undefined}>
      <div className={styles.tile} title={sv ? `Остаток × себестоимость; ${fmtInt(sv.cost_unknown_count)} позиций без цены не учтены` : "Себестоимость пока не задана"}>
        <p className={`v2-metric-label ${styles.tileLabel}`}>Стоимость запаса</p>
        <p className={`v2-metric-value ${styles.tileValue}`}>{sv ? fmtMoney(sv, true) : "—"}</p>
        {sv ? <><div className={styles.bar} aria-hidden="true"><span style={{ width: `${share}%` }} className={styles.barA} /></div><p className={styles.tileMeta}>себестоимость известна для {share} % · {fmtInt(sv.cost_unknown_count)} позиций без цены</p></> : <p className={styles.tileMeta}>{risks.find(r => r.code === "cost_unknown")?.label_ru ?? "нет данных"}</p>}
      </div>
      <Link href="/replenishment?urgency=critical" className={`${styles.tile} ${styles.tileLink}`} title="Позиции, чьё покрытие меньше срока поставки">
        <p className={`v2-metric-label ${styles.tileLabel}`}>Риск дефицита</p>
        <p className={`v2-metric-value ${styles.tileValue}`}>{fmtInt(d.pulse.stockout_risk.count)} <span className={styles.unit}>позиций</span> <ArrowRight size={18} className={styles.arrow} aria-hidden="true" /></p>
        <p className={styles.tileMeta}>покрытие меньше срока поставки (IEK 40 дн · SE 50 дн)</p>
      </Link>
      <div className={styles.tile} title="Предложения, ожидающие вашего решения">
        <p className={`v2-metric-label ${styles.tileLabel}`}>Ждут вашего решения</p>
        <p className={`v2-metric-value ${styles.tileValue}`}>{fmtInt(d.queue_count)}</p>
        <p className={styles.tileMeta}>{d.pulse.agents.needs_you} эскалаций агентов · ничего не уходит поставщику без вас</p>
      </div>
      <div className={styles.tile} title="Действия агентов, завершённые без вашего участия">
        <p className={`v2-metric-label ${styles.tileLabel}`}>Агенты сделали сами</p>
        <p className={`v2-metric-value ${styles.tileValue}`}>{fmtInt(d.pulse.agents.auto)} <span className={styles.unit}>· {fmtNum(ratio)} %</span></p>
        <div className={styles.bar} aria-hidden="true"><span style={{ width: `${ratio}%` }} className={styles.barB} /></div>
        <p className={styles.tileMeta}>из {fmtInt(d.pulse.agents.auto + d.pulse.agents.needs_you)} действий за последний расчёт</p>
      </div>
    </section>
  );
}

function TaskCard({ item }: { item: Decision }) {
  const supplier = item.title.match(/источники (\S+):/)?.[1] ?? "";
  return (
    <article className={styles.card} aria-labelledby={`c-${item.id}`}>
      <div className={styles.cardRow}>
        <span className={styles.cardIcon} aria-hidden="true"><Bot size={18} /></span>
        <div className={styles.cardMain}>
          <h3 id={`c-${item.id}`} className={styles.cardTitle}>{humanize(item.title)}</h3>
          <p className={styles.cardWhy}>{item.why.length > 220 ? `${humanize(item.why.slice(0, 220))}…` : humanize(item.why)}</p>
          <details className={styles.sources}><summary>Источники · {item.sources.length} · с {time(item.since)}</summary><ul>{item.sources.slice(0, 6).map(s => <li key={s}>{humanize(s)}</li>)}{item.sources.length > 6 && <li>… и ещё {item.sources.length - 6}</li>}</ul></details>
        </div>
        <div className={styles.cardMoney}><Pill tone="warn">Нужна ваша проверка</Pill><span className={styles.moneyMeta}>задача агента</span></div>
      </div>
      <div className={styles.cardActions}>
        <span className={styles.taskNote}>Задача агента — решение по позициям принимается в разделе «Закупки»</span>
        {supplier && <Link href={`/replenishment?supplier=${encodeURIComponent(supplier)}`} className={styles.reviewLink}>Позиции {supplier}<ArrowRight size={14} aria-hidden="true" /></Link>}
      </div>
    </article>
  );
}

function DecisionCard({ item, onDone }: { item: Decision; onDone: () => void }) {
  const { refresh } = useApiSync();
  const p = useApi<Proposal>(`/api/proposals/${encodeURIComponent(item.id)}`);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [receipt, setReceipt] = useState<string>("");
  const version = p.data?.proposal.version;
  const money = item.money_at_stake ?? null;
  const decide = async (key: "approve" | "reject") => {
    if (version === undefined) return;
    setBusy(key); setError(null);
    try {
      const r = await apiRequest<{ po_id?: string; proposal_version: number }>(`/api/proposals/${encodeURIComponent(item.id)}/${key}`, { method: "POST", body: JSON.stringify({ proposal_version: version }) });
      setReceipt(key === "approve" ? "Черновик заказа подготовлен — поставщику не отправлен. Смотрите раздел «Заказы»." : "Предложение отклонено");
      refresh(); onDone();
    } catch (e) { setError(e instanceof ApiError ? e : new ApiError(500, "unknown", "Действие не выполнено")); if (e instanceof ApiError && e.status === 409) p.reload(); }
    finally { setBusy(null); }
  };
  const approveOpt = item.options.find(o => o.key === "approve");
  const rejectOpt = item.options.find(o => o.key === "reject");
  return (
    <article className={styles.card} aria-labelledby={`c-${item.id}`}>
      <div className={styles.cardRow}>
        <span className={styles.cardIcon} aria-hidden="true"><FileText size={18} /></span>
        <div className={styles.cardMain}>
          <h3 id={`c-${item.id}`} className={styles.cardTitle}>{humanize(item.title)}</h3>
          <p className={styles.cardWhy}>{humanize(item.why)}</p>
          <details className={styles.sources}>
            <summary>Источники · {item.sources.length} · с {time(item.since)}{version !== undefined && ` · версия ${version}`}</summary>
            <ul>{item.sources.slice(0, 6).map(s => <li key={s}>{humanize(s)}</li>)}{item.sources.length > 6 && <li>… и ещё {item.sources.length - 6}</li>}</ul>
          </details>
        </div>
        <div className={styles.cardMoney}>
          {money ? <><span className={styles.moneyValue}>{fmtMoney(money)}</span><span className={styles.moneyMeta}>сумма заказа</span></> : <><span className={styles.moneyNone}>—</span><span className={styles.moneyMeta}>Себестоимость не задана</span></>}
        </div>
      </div>
      {error && <div className={`${styles.alert} ${error.status === 409 ? styles.alertStale : styles.alertError}`} role="alert"><CircleAlert size={15} aria-hidden="true" />{error.status === 409 ? "Данные обновились — предложение изменилось, проверьте новую версию." : error.message}{error.status === 409 && <button type="button" className={styles.linkBtn} onClick={() => { p.reload(); onDone(); }}>Обновить</button>}</div>}
      {receipt && <div className={`${styles.alert} ${styles.alertOk}`} role="status">{receipt}</div>}
      {!receipt && (
        <div className={styles.cardActions}>
          {p.error && <span className={styles.versionNote}>Версия предложения недоступна — обновите страницу</span>}
          {approveOpt && <Button variant="primary" busy={busy === "approve"} disabled={version === undefined || busy !== null} onClick={() => decide("approve")} title={approveOpt.effect}>{approveOpt.label}</Button>}
          {rejectOpt && <Button variant="quiet" busy={busy === "reject"} disabled={version === undefined || busy !== null} onClick={() => decide("reject")} title={rejectOpt.effect}>{rejectOpt.label}</Button>}
          <Link href={`/replenishment?supplier=${encodeURIComponent(item.title.match(/поставщику (\S+)/)?.[1] ?? "")}`} className={styles.reviewLink}>Смотреть позиции<ArrowRight size={14} aria-hidden="true" /></Link>
        </div>
      )}
    </article>
  );
}
