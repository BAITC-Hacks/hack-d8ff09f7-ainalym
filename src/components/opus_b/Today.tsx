"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CircleDashed, RefreshCw, Truck } from "lucide-react";
import { ApiError, apiRequest, useApi, useApiSync } from "@/components/shell/api";
import { AgentsLabel, ProposalStateChip, TaskStateChip } from "@/components/labels";
import { Btn, btnClass, Mark, Pill, Receipt, Skel, StateBlock, Truth } from "./ui";
import { ago, dayShort, int, moneyShort, plural, qty, type Money } from "./format";
import type { LedgerResponse, ProposalDetail, QueueItem, QueueResponse, TodayResponse } from "./types";
import s from "./today.module.css";

/** Display-only total per currency in integer minor units; currencies are never mixed. */
function perCurrency(items: Array<Money | null | undefined>): Money[] {
  const minor = new Map<string, number>();
  for (const m of items) { if (!m) continue; const v = Math.round(Number(m.amount) * 100); if (Number.isFinite(v)) minor.set(m.currency, (minor.get(m.currency) ?? 0) + v); }
  return [...minor.entries()].map(([currency, v]) => ({ amount: (v / 100).toFixed(2), currency }));
}
const time = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }); };

function Strip({ today, queue }: { today: TodayResponse; queue?: QueueResponse }) {
  const risk = today.pulse.stockout_risk;
  const proposals = (queue?.items ?? []).filter(i => i.kind === "proposal");
  const atStake = perCurrency(proposals.map(p => p.money_at_stake));
  const unpriced = proposals.filter(p => !p.money_at_stake).length;
  const committed = perCurrency(today.pulse.money.committed_by_supplier.map(c => ({ amount: c.amount, currency: c.currency })));
  const next = [...today.pulse.money.next_60d.out].sort((a, b) => a.at.localeCompare(b.at))[0];
  const split = proposals.map(p => { const m = p.title.match(/поставщику\s+([^:\s]+):\s*(\d+)/); return m ? { id: m[1], n: Number(m[2]) } : null; }).filter((x): x is { id: string; n: number } => x !== null);
  const splitTotal = Math.max(split.reduce((a, b) => a + b.n, 0), 1);
  const { auto, needs_you } = today.pulse.agents;
  const total = Math.max(auto + needs_you, 1);
  return <section className={s.strip} aria-label="Главное за день">
    <Link href="/opus_b/replenishment" className={`${s.stat} ${risk.count > 0 ? s.statBad : ""}`}>
      <span className={s.statLabel}>Под риском дефицита</span>
      <span className={s.statValue}>{int(risk.count)}<span className={s.statUnit}>артикулов</span><ArrowRight size={18} aria-hidden /></span>
      <span className={s.statSub}>запаса меньше, чем срок поставки плюс период заказа</span>
    </Link>
    <a href="#decisions" className={s.stat}>
      <span className={s.statLabel}>Ждёт вашего решения</span>
      <span className={s.statValue}>{atStake.length ? atStake.map(m => moneyShort(m)).join(" · ") : int(proposals.length)}{!atStake.length && <span className={s.statUnit}>{plural(proposals.length, "заказ", "заказа", "заказов")}</span>}<ArrowRight size={18} aria-hidden /></span>
      {split.length > 0 && <span className={s.split} aria-hidden>{split.map(x => <span key={x.id} data-supplier={x.id} style={{ width: `${(x.n / splitTotal) * 100}%` }} />)}</span>}
      <span className={s.statSub}>{split.length ? split.map(x => `${x.id} ${int(x.n)} поз.`).join(" · ") : `${int(proposals.length)} ${plural(proposals.length, "заказ", "заказа", "заказов")}`}{unpriced ? ` · ${unpriced} без себестоимости` : ""}</span>
    </a>
    <div className={s.stat}>
      <span className={s.statLabel}>Обязательства · 60 дней</span>
      <span className={s.statValue}>{committed.length ? committed.map(m => moneyShort(m)).join(" · ") : "0"}{!committed.length && <span className={s.statUnit}>₸</span>}</span>
      <span className={s.statSub}>{next ? `ближайший платёж ${dayShort(next.at)} · ${moneyShort({ amount: next.amount, currency: next.currency })}` : "появятся после утверждения заказа: 30 % при утверждении, остаток при поступлении"}</span>
    </div>
    <div className={s.stat}>
      <span className={s.statLabel}>Агенты сделали сами</span>
      <span className={s.statValue}>{int(auto)}<span className={s.statUnit}>{plural(auto, "шаг", "шага", "шагов")}</span></span>
      <span className={s.ratio} aria-hidden><span style={{ width: `${(auto / total) * 100}%` }} /><span style={{ width: `${(needs_you / total) * 100}%` }} /></span>
      <span className={s.statSub}>{int(needs_you)} ждут вас · {qty(Math.floor((auto / total) * 1000) / 10)} % без вашего участия</span>
    </div>
  </section>;
}

function ProposalCard({ item, lead, onReceipt }: { item: QueueItem; lead: boolean; onReceipt: (text: string) => void }) {
  const { refresh } = useApiSync();
  const detail = useApi<ProposalDetail>(`/api/proposals/${encodeURIComponent(item.id)}`);
  const proposal = detail.data?.proposal;
  const lines = proposal?.payload.lines ?? [];
  const units = lines.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [problem, setProblem] = useState<{ stale: boolean; text: string } | null>(null);
  const approve = item.options.find(o => o.key === "approve");
  const reject = item.options.find(o => o.key === "reject");
  const decide = async (key: "approve" | "reject") => {
    if (!proposal) return;
    const version = proposal.version;
    setBusy(key); setProblem(null);
    try {
      await apiRequest(`/api/proposals/${encodeURIComponent(item.id)}/${key}`, { method: "POST", body: JSON.stringify({ proposal_version: version }) });
      onReceipt(key === "approve" ? `«${item.title}» — черновик заказа подготовлен по версии ${version}. Поставщику ничего не отправлено.` : `«${item.title}» — отклонено.`);
      refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setProblem({ stale: true, text: "" });
      else setProblem({ stale: false, text: error instanceof ApiError ? error.message : "Не удалось сохранить решение." });
    } finally { setBusy(null); }
  };
  const supplier = proposal?.subject_id ?? item.title.match(/поставщику\s+([^:\s]+)/)?.[1];
  return <li className={`${s.card} ${lead ? s.cardLead : ""}`}>
    <span className={s.icon} aria-hidden>{supplier ? <Mark id={supplier} /> : <Truck size={18} />}</span>
    <div className={s.cardTop}>
      <h3 className={s.cardTitle}>{item.title}</h3>
      {item.money_at_stake ? <span className={s.cardMoney}>{moneyShort(item.money_at_stake)}</span> : <span className={s.cardMoneyMuted}>себестоимость не задана</span>}
    </div>
    <div className={s.cardMeta}>
      {proposal ? <>
        <span>{int(lines.length)} {plural(lines.length, "позиция", "позиции", "позиций")} · {int(units)} шт</span>
        <span>цена известна: {int(proposal.payload.cost_known_lines ?? 0)} из {int(lines.length)}</span>
        <ProposalStateChip state={proposal.state} />
        <Pill tone="neutral">версия {proposal.version}</Pill>
      </> : detail.error ? <span>Детали недоступны — решение заблокировано</span> : <Skel w={260} h={14} />}
      <span>· {ago(item.since)}</span>
    </div>
    <div className={s.actions}>
      {approve && <Btn variant={lead ? "primary" : "dark"} disabled={!proposal || busy !== null || proposal.state !== "needs_review"} aria-busy={busy === "approve"} title={approve.effect} onClick={() => decide("approve")}>{busy === "approve" ? "Сохраняю…" : approve.label}</Btn>}
      {reject && <Btn variant="outline" disabled={!proposal || busy !== null || proposal.state !== "needs_review"} aria-busy={busy === "reject"} title={reject.effect} onClick={() => decide("reject")}>{busy === "reject" ? "Сохраняю…" : reject.label}</Btn>}
      <Link className={btnClass("ghost")} href="/opus_b/replenishment">Изменить количества <ArrowRight size={15} aria-hidden /></Link>
    </div>
    {approve && <p className={s.effect}>{approve.effect}. Заказ поставщику не отправляется.</p>}
    {problem && <div style={{ gridColumn: "1 / -1", marginTop: 10 }}>{problem.stale
      ? <StateBlock kind="stale" title="Данные обновились — обновите" detail="Предложение изменилось после того, как вы его открыли. Решение не сохранено." actionLabel="Обновить" onAction={() => { setProblem(null); detail.reload(); refresh(); }} />
      : <StateBlock kind="unavailable" title="Решение не сохранено" detail={problem.text} onAction={() => setProblem(null)} actionLabel="Понятно" />}</div>}
  </li>;
}

function TaskCard({ item }: { item: QueueItem }) {
  const codes = item.sources.filter(x => /^[0-9A-Za-zА-Яа-я]+_$/.test(x));
  const shown = codes.slice(0, 5);
  return <li className={s.card}>
    <span className={s.icon} aria-hidden><CircleDashed size={18} /></span>
    <div className={s.cardTop}><h3 className={s.cardTitle}>{item.title}</h3></div>
    <div className={s.cardMeta}><TaskStateChip state="needs_review" /><span>Задача агента · {ago(item.since)}</span></div>
    <div className={s.alertRow}>
      <span>Остаток не подтверждён свежим файлом — проверьте перед заказом:</span>
      {shown.map(code => <Link key={code} href={`/opus_b/skus/${encodeURIComponent(code)}`}>{code}</Link>)}
      {codes.length > shown.length && <span>и ещё {int(codes.length - shown.length)}</span>}
    </div>
  </li>;
}

function Decisions({ queue, onReceipt }: { queue: ReturnType<typeof useApi<QueueResponse>>; onReceipt: (text: string) => void }) {
  const items = queue.data?.items ?? [];
  return <section id="decisions" className={s.section} aria-labelledby="decisions-h" tabIndex={-1}>
    <div className={s.sectionHead}><h2 id="decisions-h">Требует вашего решения</h2>{queue.data && <span className={s.count}>{items.length}</span>}</div>
    {queue.loading && !queue.data ? <div className={s.cards}>{[0, 1, 2].map(i => <Skel key={i} h={118} r={10} />)}</div>
      : queue.error && !queue.data ? <StateBlock kind="unavailable" title="Очередь решений недоступна" detail={queue.error.message} onAction={queue.reload} />
      : items.length === 0 ? <StateBlock kind="empty" title="Решений не ждёт" detail={queue.data?.empty_reason ?? "Агенты справляются сами — новые предложения появятся здесь."} />
      : <ul className={s.cards}>{items.map((item, i) => item.kind === "proposal" ? <ProposalCard key={item.id} item={item} lead={i === 0} onReceipt={onReceipt} /> : <TaskCard key={item.id} item={item} />)}</ul>}
  </section>;
}

function Ledger() {
  const [limit, setLimit] = useState(8);
  const ledger = useApi<LedgerResponse>(`/api/agent/ledger?limit=${limit}`);
  const rows = ledger.data?.rows ?? [];
  return <section className={s.section} aria-labelledby="ledger-h">
    <div className={s.sectionHead}><h2 id="ledger-h">Что сделали агенты</h2><AgentsLabel />{rows.length >= limit && limit < 40 && <button type="button" className={`${s.more} ${btnClass("ghost", "small")}`} onClick={() => setLimit(40)}>Показать больше</button>}</div>
    {ledger.loading && !ledger.data ? <div style={{ display: "grid", gap: 10 }}>{Array.from({ length: 6 }, (_, i) => <Skel key={i} h={20} />)}</div>
      : ledger.error && !ledger.data ? <StateBlock kind="unavailable" title="Журнал агентов недоступен" detail={ledger.error.message} onAction={ledger.reload} />
      : rows.length === 0 ? <StateBlock kind="empty" title="Агенты ещё ничего не делали" detail="Запустите расчёт или проиграйте событие мира." />
      : <ol className={s.feed}>{rows.map(row => <li key={row.id} className={s.feedRow}>
        <span className={s.feedTime}>{time(row.at)}</span>
        <span className={s.feedText} title={row.rationale_ru ?? undefined}>{row.summary_ru}{row.code_1c && <Link href={`/opus_b/skus/${encodeURIComponent(row.code_1c)}`}>{row.code_1c}</Link>}</span>
        {row.autonomy === "auto" ? <Pill tone="ok">сам</Pill> : row.autonomy === "escalated" ? <Pill tone="warn">ждёт вас</Pill> : <Pill>{row.autonomy}</Pill>}
      </li>)}</ol>}
  </section>;
}

function Rail({ today }: { today: TodayResponse }) {
  const risk = today.pulse.stockout_risk;
  const m = today.pulse.money;
  const share = m.stock_value?.cost_known_share;
  return <aside className={s.rail} aria-label="Риски и деньги">
    <section aria-labelledby="risk-h">
      <h2 id="risk-h" className={s.railTitle}>Риск дефицита <Link href="/opus_b/replenishment">Все {int(risk.count)} →</Link></h2>
      {risk.top.length === 0 ? <StateBlock kind="empty" title="Дефицита не ожидается" /> : <ul className={s.risk}>{risk.top.map(r => {
        const bad = r.days_of_cover <= 0; const pct = Math.max(0, Math.min(1, r.days_of_cover / Math.max(r.lead_time_days, 1)));
        return <li key={r.code_1c}><Link href={`/opus_b/skus/${encodeURIComponent(r.code_1c)}`} className={s.riskRow}>
          <span className={s.riskName}>{r.name}</span>
          <span className={`${s.riskDays} ${bad ? s.riskDaysBad : ""}`}>{bad ? `нет запаса` : `${qty(r.days_of_cover)} дн`}</span>
          <span className={s.riskMeta}>{r.code_1c} · поставка {r.lead_time_days} дн{bad ? ` · долг ${qty(Math.abs(r.days_of_cover))} дн` : ""}</span>
          <span className={`${s.meter} ${bad ? s.meterBad : ""}`} aria-hidden><span style={{ width: `${bad ? 100 : pct * 100}%` }} /></span>
        </Link></li>;
      })}</ul>}
    </section>
    <section aria-labelledby="money-h">
      <h2 id="money-h" className={s.railTitle}>Деньги</h2>
      <ul className={s.moneyList}>
        <li className={s.moneyRow}><span>Стоимость запаса</span><b>{moneyShort(m.stock_value)}</b>{share !== undefined && <small>оценка по {qty(Math.round(share * 1000) / 10)} % товаров с известной себестоимостью</small>}</li>
        {m.next_60d.out.slice(0, 4).map(o => <li key={`${o.po_id}-${o.at}-${o.kind}`} className={s.moneyRow}><span>{o.kind === "prepayment" ? "Предоплата" : "Оплата"} · {dayShort(o.at)}</span><b>−{moneyShort({ amount: o.amount, currency: o.currency })}</b><small>{o.po_id}</small></li>)}
        {m.next_60d.out.length === 0 && <li className={s.moneyRow}><span>Платежи на 60 дней</span><b>нет</b><small>заказы ещё не утверждены</small></li>}
        {m.risks.map(r => <li key={r.code} className={s.moneyRow}><span>{r.label_ru}</span><b>{r.code === "opening_cash_unknown" ? "—" : `${int(r.count)} поз.`}</b></li>)}
      </ul>
    </section>
  </aside>;
}

export function Today() {
  const { refresh } = useApiSync();
  const today = useApi<TodayResponse>("/api/today");
  const queue = useApi<QueueResponse>("/api/queue");
  const [receipt, setReceipt] = useState("");
  const [calc, setCalc] = useState<{ busy: boolean; text: string; bad: boolean }>({ busy: false, text: "", bad: false });
  const recalc = async () => {
    setCalc({ busy: true, text: "", bad: false });
    try { const r = await apiRequest<{ skus: number; recommended: number }>("/api/calc/run", { method: "POST", body: JSON.stringify({ scope: {} }) }); setCalc({ busy: false, bad: false, text: `Пересчитано: ${int(r.skus)} артикулов, ${int(r.recommended)} рекомендаций.` }); refresh(); }
    catch (e) { setCalc({ busy: false, bad: true, text: e instanceof ApiError ? e.message : "Расчёт не выполнен." }); }
  };
  return <div className={s.page}>
    <header className={s.head}>
      <div>
        <p className={s.crumb}>Закупки · ТОО «Электрокомплект»</p>
        <h1 className={s.title}>Сегодня</h1>
        <p className={s.lead}>{today.data?.lead ?? (today.loading ? "" : "Сводка недоступна")}</p>
      </div>
      <div className={s.headActions}><Btn variant="outline" onClick={recalc} disabled={calc.busy} aria-busy={calc.busy}><RefreshCw size={15} aria-hidden />{calc.busy ? "Считаю…" : "Пересчитать"}</Btn></div>
    </header>
    <Receipt tone={calc.bad ? "bad" : receipt || calc.text ? "ok" : undefined}>{calc.text || receipt}</Receipt>
    {today.loading && !today.data ? <><div className={s.strip} aria-busy="true" aria-label="Загружаю сводку">{[0, 1, 2, 3].map(i => <div key={i} className={s.stat}><Skel w={120} h={13} /><Skel w={150} h={32} /><Skel w="80%" h={12} /></div>)}</div></>
      : today.error && !today.data ? <div style={{ margin: "32px 0" }}><StateBlock kind="unavailable" title="Сводка дня недоступна" detail={today.error.message} onAction={today.reload} /></div>
      : today.data && <Strip today={today.data} queue={queue.data} />}
    {today.error && today.data && <div style={{ margin: "-24px 0 24px" }}><StateBlock kind="unavailable" title="Не удалось обновить — показываю последнее" detail={today.error.message} onAction={today.reload} /></div>}
    <div className={s.grid}>
      <div>
        <Decisions queue={queue} onReceipt={setReceipt} />
        <Ledger />
      </div>
      {today.data ? <Rail today={today.data} /> : <div className={s.rail}>{today.loading && [0, 1].map(i => <Skel key={i} h={220} r={10} />)}</div>}
    </div>
    <footer className={s.foot}><Truth axes={today.data} /><span>Версия данных {today.data?.state_version ?? "—"}</span></footer>
  </div>;
}
