"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowRight, Bot, ClipboardCheck, FileSpreadsheet, Truck } from "lucide-react";
import { apiRequest, ApiError, useApi, useApiSync } from "@/components/shell/api";
import { AgentsLabel, ProposalStateChip, type TruthAxes } from "@/components/labels";
import { B0, clock, money, monthLong, pct, plural, qty, toMinor, formatMinor, day, type Money } from "./format";
import { ErrorState, ProductImage, Pill, Skel, State, Truth, UrgencyPill, STALE_TITLE, type ApiErr } from "./ui";

import { useTodaySnapshot } from "./Shell";
import { Orders } from "./Orders";
import { RunHistory } from "./RunHistory";
import { skuHref, usePagePosition } from "./navigation";

type QueueItem = { id: string; kind: "proposal" | "task" | string; title: string; why: string; sources: string[]; money_at_stake?: Money | null; options: { key: string; label: string; effect: string }[]; href: string; since: string };
type MoneyView = { cash: Money[]; committed_by_supplier: { supplier_id: string; amount: string; currency: string; lines: number; cost_known_lines: number }[]; next_60d: { out: { at: string; amount: string; currency: string; po_id: string; kind: string }[] }; stock_value: (Money & { cost_known_share: number; cost_unknown_count?: number }) | null; risks: { code: string; count: number; label_ru: string }[] };
export type TodayResp = TruthAxes & { lead: string; queue_count: number; pulse: { stockout_risk: { count: number; top: { code_1c: string; name: string; image_url?: string | null; days_of_cover: number; lead_time_days: number; urgency?: string }[] }; agents: { auto: number; needs_you: number; ratio: number } }; empty_reason?: string; state_version: number };
type QueueResp = TruthAxes & { items: QueueItem[]; empty_reason?: string };
type LedgerRow = { id: string; kind: string; summary_ru: string; rationale_ru?: string | null; autonomy: string; result: string; provider?: string | null; code_1c?: string | null; po_id?: string | null; at: string };
type LedgerResp = TruthAxes & { rows: LedgerRow[]; stats: { auto: number; needs_you: number } };
type ProposalDetail = { proposal: { id: string; version: number; state: string; kind: string; payload: { supplier_id?: string; lines?: { qty: number; unit_cost: string | null }[] } } };

const asErr = (e: unknown): ApiErr => e instanceof ApiError ? { status: e.status, code: e.code, message: e.message } : { status: 500, code: "unknown", message: "Не удалось выполнить действие." };

function Metric({ label, value, unit, sub, href, loading, children }: { label: string; value?: string; unit?: string; sub?: React.ReactNode; href?: string; loading?: boolean; children?: React.ReactNode }) {
  return <div className="oa-metric">
    <div className="oa-metric-label">{label}{href ? <ArrowRight size={14} aria-hidden /> : null}</div>
    {loading ? <><Skel w="60%" h={34} /><Skel w="80%" h={14} /></> : <>
      <div className="oa-metric-value" data-money={value?.includes("₸") || undefined}>{value}{unit ? <small>{unit}</small> : null}</div>
      {sub ? <div className="oa-metric-sub">{sub}</div> : null}{children}
    </>}
    {href ? <Link className="oa-metric-go" href={href} aria-label={`${label}: открыть`} /> : null}
  </div>;
}

function DecisionCard({ item, onDone }: { item: QueueItem; onDone: (msg: { text: string; po?: string; kind: "ok" | "info" }) => void }) {
  const { refresh } = useApiSync();
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "busy" | "error">("idle");
  const [detail, setDetail] = useState<{ version: number; state: string; lines: number; units: number; priced: number } | null>(null);
  const [error, setError] = useState<ApiErr>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const request = useRef(0);
  const locked = useRef(false);
  const isProposal = item.kind === "proposal";
  const supplier = /поставщику\s+(\S+):/.exec(item.title)?.[1];
  async function openConfirm() {
    const generation = ++request.current;
    setPhase("loading"); setError(null); setDetail(null);
    try {
      const r = await apiRequest<ProposalDetail>(`/api/proposals/${encodeURIComponent(item.id)}`);
      if (generation !== request.current) return;
      if (r.proposal.state !== "needs_review") throw new ApiError(409, "stale", "Это предложение уже изменилось. Обновите очередь.");
      const lines = r.proposal.payload.lines ?? [];
      setDetail({ version: r.proposal.version, state: r.proposal.state, lines: lines.length, units: lines.reduce((s, l) => s + l.qty, 0), priced: lines.filter(l => l.unit_cost !== null).length });
      setPhase("ready");
    } catch (e) { if (generation === request.current) { setError(asErr(e)); setPhase("error"); } }
  }
  const close = () => { if (locked.current) return; request.current++; setPhase("idle"); setError(null); requestAnimationFrame(() => opener.current?.focus()); };
  async function decide(key: "approve" | "reject") {
    if (!detail || locked.current || error?.status === 409) return;
    locked.current = true;
    setPhase("busy"); setError(null);
    try {
      const r = await apiRequest<Record<string, unknown>>(`/api/proposals/${encodeURIComponent(item.id)}/${key}`, { method: "POST", body: JSON.stringify({ proposal_version: detail.version }) });
      const po = (r.po_id ?? (r.purchase_order as { id?: string } | undefined)?.id) as string | undefined;
      onDone(key === "approve" ? { text: `${item.title}. Черновик готов к утверждению.`, po, kind: "ok" } : { text: `${item.title} — предложение отклонено.`, kind: "info" });
      refresh();
    } catch (e) { setError(asErr(e)); setPhase("error"); requestAnimationFrame(() => opener.current?.closest("li")?.querySelector<HTMLButtonElement>(".oa-state button")?.focus()); } finally { locked.current = false; }
  }
  const open = phase !== "idle";
  return <li className="oa-card oa-decision" data-kind={item.kind} onKeyDown={e => { if (e.key === "Escape" && open) { e.stopPropagation(); close(); } }}>
    <span className="oa-icon" data-tone={isProposal ? "accent" : undefined} aria-hidden>{isProposal ? <Truck size={18} /> : <ClipboardCheck size={18} />}</span>
    <div>
      <h3>{item.title}</h3>
      <p>{whyRu(item)}</p>
      <div className="oa-decision-meta">
        <ProposalStateChipLike kind={item.kind} />
        <span className="muted" style={{ font: "var(--oa-meta)" }}>{qty(item.sources.length)} {plural(item.sources.length, "источник", "источника", "источников")} · с {clock(item.since)}</span>
      </div>
    </div>
    <div className="oa-decision-amount">
      {item.money_at_stake ? <strong>{money(item.money_at_stake)}</strong> : isProposal ? <span className="oa-nocost">себестоимость не задана</span> : null}
      {isProposal ? <span className="muted" style={{ font: "var(--oa-meta)" }}>известная стоимость</span> : null}
    </div>
    <div className="oa-decision-actions">
      {isProposal ? <>
        <button ref={opener} type="button" className="oa-btn oa-btn-black oa-btn-sm" aria-expanded={open} disabled={phase === "busy"} onClick={() => open ? close() : openConfirm()}>{open ? "Скрыть" : "Решить…"}</button>
        {supplier ? <Link className="oa-btn oa-btn-outline oa-btn-sm" href={`/opus_a/replenishment?supplier=${encodeURIComponent(supplier)}`}>Проверить количества</Link> : null}
      </> : <Link className="oa-btn oa-btn-outline oa-btn-sm" href={`/review/${encodeURIComponent(item.id)}`}>Открыть проверку</Link>}
    </div>
    {open && isProposal ? <div className="oa-confirm" role="group" aria-label="Подтверждение решения">
      {phase === "loading" ? <div style={{ display: "grid", gap: 8 }}><Skel w="70%" h={18} /><Skel w="40%" h={18} /></div> : null}
      {detail && (phase === "ready" || phase === "busy" || phase === "error") ? <>
        <dl>
          <div><dt>Версия</dt><dd>v{detail.version}</dd></div>
          <div><dt>Позиций</dt><dd>{qty(detail.lines)}</dd></div>
          <div><dt>Штук</dt><dd>{qty(detail.units)}</dd></div>
          <div><dt>Цена известна</dt><dd>{qty(detail.priced)} из {qty(detail.lines)}</dd></div>
        </dl>
        <div className="oa-decision-actions" style={{ gridColumn: "auto" }}>
          <button autoFocus type="button" className="oa-btn oa-btn-black" disabled={phase === "busy" || error?.status === 409} onClick={() => decide("approve")}>{phase === "busy" ? "Сохраняю…" : "Подготовить заказ"}</button>
          <button type="button" className="oa-btn oa-btn-outline" disabled={phase === "busy" || error?.status === 409} onClick={() => decide("reject")}>Отклонить</button>
          <button type="button" className="oa-btn oa-btn-ghost" disabled={phase === "busy"} onClick={close}>Отмена <span className="oa-kbd" aria-hidden>Esc</span></button>
          <span className="muted" style={{ font: "var(--oa-meta)" }}>Создаётся черновик с этим составом. Затем можно утвердить заказ и скачать файл для 1С.</span>
        </div>
      </> : null}
      {error ? <ErrorState error={error} onRetry={() => { refresh(); void openConfirm(); }} /> : null}
    </div> : null}
  </li>;
}
/** Source-gap tasks arrive with engine text; show it in short business Russian with the first codes. */
function whyRu(item: QueueItem): string {
  const gaps = [...item.why.matchAll(/(\S+_): stock source missing for \S+: latest confirmed month (\d{4}-\d{2})/g)];
  if (item.kind !== "proposal" && gaps.length) {
    const first = gaps.slice(0, 3).map(g => `${g[1]} — остаток на ${monthLong(g[2])}`).join("; ");
    return `Нет свежего остатка по ${qty(item.sources.length)} SKU — проверьте склад перед заказом. Например: ${first}.`;
  }
  return item.why;
}
function ProposalStateChipLike({ kind }: { kind: string }) {
  return kind === "proposal" ? <ProposalStateChip state="needs_review" /> : <Pill tone="warn">Нужна ваша проверка</Pill>;
}

function CoverBar({ days, lead }: { days: number; lead: number }) {
  const max = Math.max(lead * 1.5, 1);
  const fill = Math.max(0, Math.min(days, max)) / max * 100;
  return <div className="oa-cover">
    <span>{days <= 0 ? `нет запаса · ${qty(days, 1)} дн` : `${qty(days, 1)} дн покрытия`} · срок {lead} дн</span>
    <div className="track" aria-hidden><i style={{ width: `${fill}%`, background: days < lead ? "var(--oa-bad-dot)" : "var(--oa-sage)" }} /><b style={{ left: `${lead / max * 100}%` }} /></div>
  </div>;
}

export function TodayView() {
  const today = useTodaySnapshot();
  const queue = useApi<QueueResp>("/api/queue");
  const ledger = useApi<LedgerResp>("/api/agent/ledger?limit=12");
  const cash = useApi<MoneyView & TruthAxes>("/api/money");
  const [receipts, setReceipts] = useState<{ text: string; po?: string; kind: "ok" | "info" }[]>([]);
  usePagePosition(!!today.data && !!queue.data);
  const t = today.data; const items = queue.data?.items ?? [];
  const proposals = items.filter(i => i.kind === "proposal"); const tasks = items.length - proposals.length;
  const atStake = proposals.reduce((s, p) => s + (p.money_at_stake ? toMinor(p.money_at_stake.amount) : B0), B0);
  const unpriced = proposals.filter(p => !p.money_at_stake).map(p => /поставщику\s+(\S+):/.exec(p.title)?.[1] ?? "").filter(Boolean);
  const m = cash.data;
  return <main className="oa-page" id="main">
    <div className="oa-head">
      <div>
        <div className="oa-crumb">Закупки · Электрокомплект</div>
        <h1>Сегодня</h1>
      </div>
      <div className="oa-head-actions">
        <Link href="/opus_a/replenishment" className="oa-btn oa-btn-primary">Проверить рекомендации<ArrowRight size={16} aria-hidden /></Link>
      </div>
    </div>
    <div style={{ display: "grid", gap: 12 }}>
      {t ? <p className="oa-lead">{t.lead}</p> : today.loading ? <Skel w="52%" h={24} /> : null}
      <Truth axes={t ?? queue.data} />
      <RunHistory />
    </div>
    {today.error && !t ? <ErrorState error={today.error} onRetry={today.reload} /> : null}

    <section className="oa-strip" aria-label="Главные цифры">
      <Metric loading={today.loading && !t} label="Под риском дефицита" href="/opus_a/replenishment" value={qty(t?.pulse.stockout_risk.count)} unit="SKU" sub="запаса меньше, чем на срок поставки" />
      <Metric loading={today.loading || queue.loading} label="Ждут вашего решения" value={qty(t?.queue_count)} unit={plural(t?.queue_count ?? 0, "решение", "решения", "решений")} sub={`${qty(proposals.length)} ${plural(proposals.length, "заказ", "заказа", "заказов")} поставщикам · ${qty(tasks)} ${plural(tasks, "задача", "задачи", "задач")}`} />
      <Metric loading={queue.loading && !queue.data} label="Стоимость рекомендаций" value={proposals.some(p => p.money_at_stake) ? formatMinor(atStake) : "—"} sub={unpriced.length ? <>{unpriced.join(", ")}: <span className="oa-nocost">себестоимость не задана</span></> : proposals.length ? "по известным ценам" : "Нет рекомендаций"} />
      <Metric loading={today.loading && !t} label="Агенты сделали сами" value={qty(t?.pulse.agents.auto)} unit={plural(t?.pulse.agents.auto ?? 0, "действие", "действия", "действий")} sub={t ? `${pct(t.pulse.agents.ratio)} без вас · ${qty(t.pulse.agents.needs_you)} ждут вас` : undefined}>
        {t ? <div className="oa-meter" aria-hidden><i style={{ width: `${t.pulse.agents.ratio * 100}%`, background: "var(--oa-sage)" }} /><i style={{ flex: 1, background: "var(--oa-warn-dot)" }} /></div> : null}
      </Metric>
    </section>

    <div className="oa-cols">
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 36, minWidth: 0 }}>
        <section style={{ display: "grid", gap: 14 }} aria-labelledby="oa-dec">
          <div className="oa-section-head"><h2 className="oa-h2" id="oa-dec">Ждут вашего решения <span className="oa-count">{queue.data ? items.length : "…"}</span></h2><span className="muted" style={{ font: "var(--oa-meta)" }}>Агенты ничего не отправляют без вашего решения</span></div>
          {receipts.map((r, i) => <State key={i} kind={r.kind} title={r.text}>{r.po ? <Link className="oa-link" href={`#order-${r.po}`}>Проверить и утвердить заказ</Link> : null}</State>)}
          {queue.loading && !queue.data ? <ul className="oa-list">{[0, 1, 2].map(i => <li key={i} className="oa-card oa-decision"><Skel w={40} h={40} style={{ borderRadius: 20 }} /><div style={{ display: "grid", gap: 8 }}><Skel w="50%" h={20} /><Skel w="90%" h={14} /></div><Skel w={120} h={20} /></li>)}</ul> : null}
          {queue.error ? <ErrorState error={queue.error} onRetry={queue.reload} /> : null}
          {queue.data && items.length === 0 ? <State kind="empty" title="Решений нет">{queue.data.empty_reason ?? "Когда агенты подготовят заказ, он появится здесь."}</State> : null}
          {items.length ? <ul className="oa-list">{items.map(item => <DecisionCard key={item.id} item={item} onDone={r => setReceipts(list => [r, ...list].slice(0, 3))} />)}</ul> : null}
        </section>

        <Orders />

        <section style={{ display: "grid", gap: 14 }} aria-labelledby="oa-risk">
          <div className="oa-section-head"><h2 className="oa-h2" id="oa-risk">Риск дефицита <small>{t ? `${qty(t.pulse.stockout_risk.count)} SKU, самые срочные` : ""}</small></h2><Link className="oa-link" href="/opus_a/replenishment">Все рекомендации</Link></div>
          {!t && today.loading ? <ul className="oa-risk">{[0, 1, 2, 3].map(i => <li key={i}><div style={{ padding: 18 }}><Skel h={18} /></div></li>)}</ul> : null}
          {t && t.pulse.stockout_risk.top.length === 0 ? <State kind="empty" title="Риска дефицита нет">Все SKU покрыты на срок поставки.</State> : null}
          {t && t.pulse.stockout_risk.top.length ? <ul className="oa-risk">{t.pulse.stockout_risk.top.map(r => <li key={r.code_1c}>
            <Link href={skuHref(r.code_1c)}>
              <div className="oa-goods"><ProductImage src={r.image_url} /><div style={{ minWidth: 0 }}><div className="n">{r.name}</div><div className="muted" style={{ font: "var(--oa-meta)" }}>{r.code_1c}</div></div></div>
              <CoverBar days={r.days_of_cover} lead={r.lead_time_days} />
              <div style={{ justifySelf: "end" }}><UrgencyPill urgency={r.urgency ?? (r.days_of_cover < r.lead_time_days ? "critical" : "soon")} /></div>
            </Link></li>)}</ul> : null}
        </section>
      </div>

      <aside className="oa-rightrail" aria-label="Деньги и агенты">
        <section className="oa-rail-block" aria-labelledby="oa-money">
          <h2 id="oa-money">Деньги</h2>
          {cash.error && !m ? <ErrorState error={cash.error} onRetry={cash.reload} /> : null}
          {!m && cash.loading ? <div style={{ display: "grid", gap: 10 }}><Skel h={40} /><Skel h={40} /></div> : null}
          {m ? <div>
            {m.committed_by_supplier.length ? m.committed_by_supplier.map(c => <div className="oa-kv" key={c.supplier_id}><b>Обязательства · {c.supplier_id}</b><span className="num">{money({ amount: c.amount, currency: c.currency })}</span><span>{qty(c.lines)} строк · цена известна для {qty(c.cost_known_lines)}</span></div>)
              : <div className="oa-kv"><b>Обязательства по поставщикам</b><span className="num">0 ₸</span><span>Появятся после утверждения заказа</span></div>}
            {m.next_60d.out.length ? m.next_60d.out.slice(0, 4).map(o => <div className="oa-kv" key={`${o.po_id}-${o.at}-${o.kind}`}><b>{o.kind === "prepayment" ? "Предоплата 30 %" : o.kind === "balance" ? "Остаток при поставке" : "Выплата"}</b><span className="num">−{money({ amount: o.amount, currency: o.currency })}</span><span>{day(o.at)}</span></div>)
              : <div className="oa-kv"><b>Выплаты за 60 дней</b><span className="num">—</span><span>Нет утверждённых заказов</span></div>}
            {m.stock_value ? <div className="oa-kv"><b>Стоимость запаса</b><span className="num">{money(m.stock_value)}</span><span style={{ gridColumn: "1 / -1" }}>себестоимость известна для {pct(m.stock_value.cost_known_share)} позиций
              <span className="oa-meter" aria-hidden><i style={{ width: `${m.stock_value.cost_known_share * 100}%`, background: "var(--oa-plum)" }} /></span></span></div> : null}
            {m.risks.map(r => <div className="oa-kv" key={r.code} style={{ background: "var(--oa-alert-row)", color: "var(--oa-alert-ink)", padding: "10px 12px", borderRadius: 4, marginTop: 8, borderTop: 0 }}><b style={{ color: "inherit" }}>{r.label_ru}</b><span className="num" style={{ color: "inherit" }}>{qty(r.count)}</span></div>)}
          </div> : null}
        </section>
        <section className="oa-rail-block" aria-labelledby="oa-agents">
          <div className="oa-section-head"><h2 id="oa-agents">Что сделали агенты</h2><AgentsLabel /></div>
          {ledger.error && !ledger.data ? <ErrorState error={ledger.error} onRetry={ledger.reload} /> : null}
          {!ledger.data && ledger.loading ? <div style={{ display: "grid", gap: 10 }}>{[0, 1, 2, 3].map(i => <Skel key={i} h={36} />)}</div> : null}
          {ledger.data && ledger.data.rows.length === 0 ? <State kind="empty" title="Журнал пуст">Агенты ещё ничего не делали.</State> : null}
          {ledger.data?.rows.length ? <ol className="oa-feed" aria-label="Журнал агентов">{ledger.data.rows.map(r => <li key={r.id}>
            <span className="dot" data-tone={r.result === "failed" ? "bad" : r.autonomy === "auto" ? undefined : "warn"} aria-hidden />
            <div style={{ minWidth: 0 }}><div className="t">{r.summary_ru}</div><div className="m">{r.autonomy === "auto" ? "сам" : "ждёт вас"}{r.code_1c ? <> · <Link className="oa-link" href={skuHref(r.code_1c)}>{r.code_1c}</Link></> : null}{r.provider ? ` · ${r.provider}` : ""}</div></div>
            <time dateTime={r.at}>{clock(r.at).split(", ")[1] ?? clock(r.at)}</time>
          </li>)}</ol> : null}
          <div className="muted" style={{ font: "var(--oa-meta)", display: "flex", gap: 8, alignItems: "center" }}><Bot size={14} aria-hidden />{ledger.data ? `${qty(ledger.data.stats.auto)} сами · ${qty(ledger.data.stats.needs_you)} ждут вас` : " "}</div>
        </section>
        <div className="muted" style={{ font: "var(--oa-meta)", display: "flex", gap: 8 }}><FileSpreadsheet size={14} aria-hidden />Экспорт для 1С (файл) — после утверждения заказа.</div>
      </aside>
    </div>
    {today.error?.status === 409 ? <State kind="stale" title={STALE_TITLE} onRetry={today.reload} retryLabel="Обновить" /> : null}
  </main>;
}
