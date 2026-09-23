"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
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
type MoneyLite = { cash: { amount: string; currency: string }[]; next_60d: { out: { at: string; amount: string; currency: string }[] } };
type Proposal = { proposal: { id: string; version: number; state: string; subject_id: string } };

const time = (iso: string) => new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
const today = new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });

export default function TodayPage() {
  const t = useTodaySnapshot<Today>();
  const q = useApi<Queue>("/api/queue");
  const m = useApi<MoneyLite>("/api/money");
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
      {m.data && <Outlook m={m.data} />}

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

/* ---------- 60-day money outlook: one glance at whether the cash covers the supplier payouts ---------- */
const DAYS = 60, WEEKS = 9, W = 800, H = 200, PAD = { l: 8, r: 8, t: 14, b: 8 };
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const shortDate = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }).replace(".", "");

function Outlook({ m }: { m: MoneyLite }) {
  const model = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const cashKnown = m.cash.length > 0;
    const cash = cashKnown ? Number(m.cash[0].amount) : 0;
    const cur = m.cash[0]?.currency ?? m.next_60d.out[0]?.currency ?? "KZT";
    const perDay = new Array<number>(DAYS + 1).fill(0);
    for (const o of m.next_60d.out) {
      const day = Math.round((new Date(o.at).setHours(0, 0, 0, 0) - start.getTime()) / 86400000);
      if (day > DAYS) continue;
      perDay[Math.max(0, day)] += Number(o.amount);
    }
    const weeks = new Array<number>(WEEKS).fill(0);
    perDay.forEach((v, i) => { weeks[Math.min(WEEKS - 1, Math.floor(i / 7))] += v; });
    const balance: number[] = []; let acc = cash; let runsOutDay: number | null = null;
    perDay.forEach((v, i) => { acc -= v; balance.push(acc); if (cashKnown && acc < 0 && runsOutDay === null) runsOutDay = i; });
    const totalOut = perDay.reduce((a, b) => a + b, 0);
    const peakWeek = weeks.reduce((best, v, i) => (v > weeks[best] ? i : best), 0);
    const weekStart = (i: number) => new Date(start.getTime() + i * 7 * 86400000);
    return { start, cashKnown, cash, cur, weeks, balance, runsOutDay, totalOut, peakWeek, weekStart, hasOut: totalOut > 0 };
  }, [m]);
  const { cashKnown, cash, cur, weeks, balance, runsOutDay, totalOut, peakWeek, weekStart, hasOut, start } = model;
  const money = (n: number) => fmtMoney({ amount: String(Math.round(n)), currency: cur }, true);

  if (!cashKnown && !hasOut) {
    return <section className={styles.outlook} aria-label="Деньги на 60 дней">
      <div className={styles.outlookHead}><h2 className={styles.h3}>Деньги на 60 дней</h2></div>
      <p className={styles.outlookEmpty}>Чтобы видеть, хватает ли денег на выплаты поставщикам, <Link href="/settings#opening_cash">заполните остаток на счетах в Настройках</Link>.</p>
    </section>;
  }

  const top = Math.max(cashKnown ? cash : 0, ...weeks, 1);
  const bottom = Math.min(0, ...(cashKnown ? balance : [0]));
  const span = top - bottom || 1;
  const y = (v: number) => PAD.t + ((top - v) / span) * (H - PAD.t - PAD.b);
  const x = (day: number) => PAD.l + (day / DAYS) * (W - PAD.l - PAD.r);
  const slot = (W - PAD.l - PAD.r) / WEEKS, barW = slot * 0.5;
  const line = balance.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(DAYS).toFixed(1)} ${y(0).toFixed(1)} L${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`;
  const runsOut = runsOutDay === null ? null : new Date(start.getTime() + runsOutDay * 86400000);
  const endBalance = balance[DAYS];
  const caption1 = !cashKnown ? "Остаток на счетах не задан — график показывает только выплаты" : !hasOut ? `На счетах ${money(cash)} · выплат поставщикам в ближайшие 60 дней нет` : runsOut ? `Денег на счетах хватает до ${shortDate(runsOut)} — дальше не хватает ${money(-endBalance)}` : `Денег на счетах хватает на все выплаты · останется ${money(endBalance)}`;
  const caption2 = hasOut ? `Пик выплат: ${money(weeks[peakWeek])}, неделя ${shortDate(weekStart(peakWeek))} – ${shortDate(new Date(weekStart(peakWeek).getTime() + 6 * 86400000))} · всего ${money(totalOut)}` : "Утверждённые заказы поставят выплаты на календарь";

  return <section className={styles.outlook} aria-label="Деньги на 60 дней">
    <div className={styles.outlookHead}>
      <div><h2 className={styles.h3}>Деньги на 60 дней</h2><p className={`${styles.outlookCap} ${runsOut ? styles.outlookWarn : ""}`}>{caption1}</p><p className={styles.outlookCap2}>{caption2}</p></div>
      <Link href="/money" className={styles.more}>Деньги <ArrowRight size={13} aria-hidden="true" /></Link>
    </div>
    <svg className={styles.outlookSvg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${caption1}. ${caption2}`}>
      <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} className={styles.zero} />
      {weeks.map((v, i) => v > 0 && <rect key={i} x={x(i * 7) + slot / 2 - barW / 2} y={y(v)} width={barW} height={Math.max(2, y(0) - y(v))} rx={2} className={styles.payout}><title>{`Выплаты ${shortDate(weekStart(i))} – ${shortDate(new Date(weekStart(i).getTime() + 6 * 86400000))}: ${money(v)}`}</title></rect>)}
      {cashKnown && <><path d={area} className={styles.cashArea} /><path d={line} className={styles.cashLine} /></>}
      {cashKnown && <circle cx={x(0)} cy={y(cash)} r={3.5} className={styles.cashDot} />}
      <line x1={x(0)} x2={x(0)} y1={PAD.t - 8} y2={H - PAD.b} className={styles.todayLine} />
      {runsOutDay !== null && <line x1={x(runsOutDay)} x2={x(runsOutDay)} y1={PAD.t} y2={H - PAD.b} className={styles.runsOutLine} />}
    </svg>
    <div className={styles.outlookAxis} aria-hidden="true">{weeks.map((_, i) => <span key={i}>{i === 0 ? "сегодня" : shortDate(weekStart(i))}</span>)}</div>
    <div className={styles.outlookLegend} aria-hidden="true">{cashKnown && <span><i className={styles.legLine} />остаток на счетах</span>}<span><i className={styles.legBar} />выплаты поставщикам за неделю</span>{cashKnown && <span className={styles.outlookLegVal}>сейчас {money(cash)}</span>}</div>
  </section>;
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
      <Link href="/replenishment?urgency=critical" className={`v2-priority-link ${styles.tile} ${styles.tileLink}`} title="Позиции, чьё покрытие меньше срока поставки">
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
          <Link href={`/replenishment?supplier=${encodeURIComponent(item.title.match(/поставщику ([^\s:]+)/)?.[1] ?? "")}`} className={styles.reviewLink}>Смотреть позиции<ArrowRight size={14} aria-hidden="true" /></Link>
        </div>
      )}
    </article>
  );
}
