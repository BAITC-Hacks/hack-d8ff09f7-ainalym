"use client";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronRight, Search, TriangleAlert } from "lucide-react";
import { useApi } from "@/components/shell/api";
import type { TruthAxes } from "@/components/labels";
import { formatMinor, lineCost, money, qty, type Money } from "./format";
import { ErrorState, ProductImage, Skel, State, Truth, UrgencyPill, URGENCY_ORDER } from "./ui";
import { AdjustForm, useAdjustmentAvailability } from "./AdjustForm";
import { RunHistory } from "./RunHistory";
import { skuHref, usePagePosition } from "./navigation";
import { Exclusions, Forecast, Receipt, type Components } from "./rationale";

type Row = { id: string; code_1c: string; name: string; image_url?: string | null; article?: string | null; on_hand: string; in_transit: string; forecast_qty: string | null; qty_recommended: number; qty_adjusted: number | null; moq: number; urgency: string; rationale_ru: string; components: Components; stockout_months: string[] };
type Group = { supplier_id: string; total_qty: number; total_cost: Money | null; cost_known_lines: number; rows: Row[] };
type RecResp = TruthAxes & { groups: Group[]; state_version: number };
type SkuList = { items: { code_1c: string; unit_cost: string | null }[]; total: number };
const TABS = [["all", "Все"], ["critical", "Критично"], ["soon", "Скоро"], ["normal", "Планово"]] as const;
const PAGE = 40;
const RecRow = memo(function RecRow({ row, cost, open, onToggle }: { row: Row; cost: bigint | null; open: boolean; onToggle: (id: string, toggleEl?: HTMLElement | null) => void }) {
  const c = row.components;
  const toggle = useRef<HTMLButtonElement>(null);
  const [editing, setEditing] = useState(false);
  const canAdjust = useAdjustmentAvailability(open ? row.id : undefined);
  return <>
    <tr className="oa-row" data-open={open}>
      <td className="oa-goods-cell">
        <button ref={toggle} type="button" className="oa-rowbtn" data-row-toggle aria-expanded={open} aria-controls={`why-${row.id}`} onClick={() => onToggle(row.id)}>
          <ChevronRight size={16} aria-hidden /><span className="oa-goods"><ProductImage src={row.image_url} /><span><span className="n">{row.name}</span><span className="c">{row.code_1c}{c.days_of_cover !== undefined ? ` · покрытие ${qty(c.days_of_cover, 1)} дн` : ""}</span></span></span>
        </button>
      </td>
      <td data-label="Срочность"><UrgencyPill urgency={row.urgency} /></td>
      <td className="num" data-label="Прогноз">{qty(row.forecast_qty)}</td>
      <td className="num" data-label="Остаток">{qty(row.on_hand)}</td>
      <td className="num" data-label="В пути">{qty(row.in_transit)}</td>
      <td className="num oa-hide-sm">{qty(c.safety)}</td>
      <td className="num oa-hide-sm">{qty(row.moq)}</td>
      <td className="num" data-label="К заказу, шт"><span className="oa-qty">{row.qty_adjusted !== null && row.qty_adjusted !== row.qty_recommended ? <><s>{qty(row.qty_recommended)}</s>{qty(row.qty_adjusted)}</> : qty(row.qty_recommended)}</span></td>
      <td className="num" data-label="Стоимость">{cost !== null ? formatMinor(cost) : <span className="oa-nocost">себестоимость не задана</span>}</td>
    </tr>
    {c.stock_stale ? <tr className="oa-alert-row"><td colSpan={9}><TriangleAlert size={13} aria-hidden style={{ verticalAlign: -2, marginRight: 6 }} />Остаток устарел: последнее подтверждение {c.stock_month ?? "—"}. Проверьте склад перед заказом.</td></tr> : null}
    {open ? <tr className="oa-why" id={`why-${row.id}`}><td colSpan={9} onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); onToggle(row.id, toggle.current); } }}>
      <div className="oa-why-in">
        <div className="oa-why-heading"><div><strong>{row.name}</strong><span className="muted">Код 1С {row.code_1c}</span></div><Link className="oa-btn oa-btn-outline" href={skuHref(row.code_1c)}>Карточка товара<ArrowRight size={16} aria-hidden /></Link></div>
        <div><h4>Из чего сложилось количество</h4><Receipt c={c} recommended={row.qty_recommended} adjusted={row.qty_adjusted} /></div>
        <Forecast c={c} />
        <Exclusions c={c} />
        <details className="oa-engine-text"><summary>Пояснение расчёта</summary><p>{row.rationale_ru}</p></details>
        {canAdjust === false ? <div className="oa-adjust"><State kind="unavailable" title="Изменение количества пока недоступно">Сервис корректировки недоступен. Количество не изменено.</State></div> : editing ? <AdjustForm row={row} onClose={() => { setEditing(false); toggle.current?.focus(); }} /> : <div className="oa-adjust"><button type="button" className="oa-btn oa-btn-black" disabled={canAdjust !== true} onClick={() => setEditing(true)}>{canAdjust === null ? "Проверяю изменение…" : "Изменить количество"}</button><button type="button" className="oa-btn oa-btn-ghost" onClick={() => onToggle(row.id, toggle.current)}>Свернуть <span className="oa-kbd" aria-hidden>Esc</span></button></div>}
      </div>
    </td></tr> : null}
  </>;
});

export function ReplenishmentView({ supplier, initialCode }: { supplier?: string; initialCode?: string }) {
  const path = supplier ? `/api/recommendations?supplier=${encodeURIComponent(supplier)}` : "/api/recommendations";
  const recs = useApi<RecResp>(path);
  const needSe = !supplier || supplier === "SE";
  const se1 = useApi<SkuList>(needSe ? "/api/skus?supplier=SE&limit=500&offset=0" : "/api/skus?supplier=SE&limit=1");
  const se2 = useApi<SkuList>(needSe ? "/api/skus?supplier=SE&limit=500&offset=500" : "/api/skus?supplier=SE&limit=1&offset=1");
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("all");
  const [q, setQ] = useState(initialCode ?? "");
  const [openId, setOpenId] = useState<string | null>(initialCode ? `code:${initialCode}` : null);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const tableRef = useRef<HTMLDivElement>(null);
  const [restored, setRestored] = useState(false);
  const memoryKey = `oa:list:${supplier ?? "all"}`;
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(memoryKey) ?? "null");
      if (saved && !initialCode) { setQ(saved.q ?? ""); setTab(saved.tab ?? "all"); setOpenId(saved.openId ?? null); setLimits(saved.limits ?? {}); }
    } catch { /* A discarded view cache never blocks server data. */ }
    setRestored(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [memoryKey, initialCode]);
  useEffect(() => {
    if (restored) sessionStorage.setItem(memoryKey, JSON.stringify({ q, tab, openId, limits }));
  }, [restored, memoryKey, q, tab, openId, limits]);
  usePagePosition(restored && !!recs.data);
  const costs = useMemo(() => new Map([...(se1.data?.items ?? []), ...(se2.data?.items ?? [])].map(s => [s.code_1c, s.unit_cost])), [se1.data, se2.data]);
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (recs.data?.groups ?? []).map(g => {
      const matched = g.rows.filter(r => !term || r.name.toLowerCase().includes(term) || r.code_1c.includes(term));
      const counts = { all: matched.length, critical: 0, soon: 0, normal: 0 } as Record<string, number>;
      matched.forEach(r => { counts[r.urgency] = (counts[r.urgency] ?? 0) + 1; });
      const rows = matched.filter(r => tab === "all" || r.urgency === tab).sort((a, b) => (URGENCY_ORDER[a.urgency] ?? 9) - (URGENCY_ORDER[b.urgency] ?? 9) || (a.components.days_of_cover ?? 0) - (b.components.days_of_cover ?? 0));
      return { ...g, rows, counts, sourceCount: g.rows.length };
    });
  }, [recs.data, q, tab]);
  const totals = useMemo(() => groups.reduce((acc, g) => { Object.entries(g.counts).forEach(([k, v]) => { acc[k] = (acc[k] ?? 0) + v; }); return acc; }, {} as Record<string, number>), [groups]);
  const onToggle = useCallback((id: string, focusEl?: HTMLElement | null) => { setOpenId(cur => cur === id || cur?.startsWith("code:") ? null : id); if (focusEl) requestAnimationFrame(() => focusEl.focus()); }, []);
  const onKeyNav = (e: React.KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End", "j", "k", "Escape"].includes(e.key)) return;
    const target = e.target as HTMLElement;
    if (!target.matches("[data-row-toggle]")) return;
    if (e.key === "Escape") { setOpenId(null); return; }
    const all = Array.from(tableRef.current?.querySelectorAll<HTMLElement>("[data-row-toggle]") ?? []);
    const i = all.indexOf(target);
    const next = e.key === "Home" ? all[0] : e.key === "End" ? all[all.length - 1] : all[i + (["ArrowDown", "j"].includes(e.key) ? 1 : -1)];
    if (next) { e.preventDefault(); next.focus(); next.scrollIntoView({ block: "nearest" }); }
  };
  const seg = [["", "Все поставщики"], ["IEK", "IEK"], ["SE", "SE"]] as const;
  return <main className="oa-page" id="main">
    <div className="oa-head">
      <div><div className="oa-crumb"><Link href="/opus_a/today">Сегодня</Link> / Закупки</div><h1>Пополнение</h1></div>
      <div className="oa-head-actions"><Link href="/opus_a/today" className="oa-btn oa-btn-primary">К решениям<ArrowRight size={16} aria-hidden /></Link></div>
    </div>
    <div style={{ display: "grid", gap: 10 }}>
      <p className="oa-lead">Проверьте количества. Откройте товар, чтобы увидеть расчёт.</p>
      <Truth axes={recs.data} />
      <RunHistory supplier={supplier} />
    </div>
    <div role="tablist" aria-label="Срочность" className="oa-tabs" onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const index = TABS.findIndex(([key]) => key === tab);
      const next = event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
      setTab(TABS[next][0]); (event.currentTarget.children[next] as HTMLElement).focus();
    }}>
      {TABS.map(([key, label]) => <button key={key} role="tab" id={`oa-tab-${key}`} aria-controls="oa-recommendations" tabIndex={tab === key ? 0 : -1} type="button" aria-selected={tab === key} onClick={() => setTab(key)}>{label}<span className="c">{recs.data ? qty(totals[key] ?? 0) : "…"}</span></button>)}
    </div>
    <div className="oa-toolbar">
      <label className="oa-filter"><Search size={15} aria-hidden /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Фильтр по названию или коду 1С" aria-label="Фильтр по названию или коду 1С" /></label>
      <nav className="oa-seg" aria-label="Поставщик">{seg.map(([id, label]) => <Link key={id || "all"} aria-current={(supplier ?? "") === id ? "true" : undefined} href={id ? `/opus_a/replenishment?supplier=${id}` : "/opus_a/replenishment"}>{label}</Link>)}</nav>
      <span className="muted oa-hide-sm" style={{ font: "var(--oa-meta)", marginLeft: "auto" }}>↑ ↓ / j k · Enter: расчёт · Esc: свернуть</span>
    </div>
    {recs.error ? <ErrorState error={recs.error} onRetry={recs.reload} /> : null}
    {recs.loading && !recs.data ? <div className="oa-group"><div className="oa-group-head"><Skel w={160} h={22} /></div>{Array.from({ length: 8 }, (_, i) => <div key={i} style={{ padding: "16px 18px", borderTop: "1px solid var(--oa-line-soft)" }}><Skel h={20} /></div>)}</div> : null}
    {recs.data && groups.length === 0 ? <State kind="empty" title="Рекомендаций нет">Запустите расчёт — рекомендации появятся здесь, сгруппированные по поставщикам.</State> : null}
    {recs.data && groups.length > 0 && groups.every(g => g.rows.length === 0) ? <State kind="empty" title="По этому фильтру товаров нет" onRetry={() => { setQ(""); setTab("all"); }} retryLabel="Сбросить фильтр">{q ? `Поиск: «${q}». ` : ""}Выберите другую срочность или измените запрос.</State> : null}
    <div id="oa-recommendations" role="tabpanel" aria-labelledby={`oa-tab-${tab}`} ref={tableRef} onKeyDown={onKeyNav} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 28 }}>
      {groups.filter(g => g.rows.length > 0).map(g => {
        const limit = limits[g.supplier_id] ?? PAGE;
        const shown = g.rows.slice(0, limit);
        return <section key={g.supplier_id} className="oa-group" aria-label={`Поставщик ${g.supplier_id}`}>
          <div className="oa-group-head">
            <h2>{g.supplier_id}</h2>
            <span className="muted" style={{ font: "var(--oa-meta)" }}>{qty(g.rows.length)} из {qty(g.sourceCount)} позиций</span>
            <div className="sum">
              {g.total_cost ? <span><strong>{money(g.total_cost)}</strong> <span className="muted">весь заказ</span> <span className="muted" style={{ font: "var(--oa-meta)" }}>цена известна для {qty(g.cost_known_lines)} из {qty(g.sourceCount)}</span></span> : <span className="oa-nocost">себестоимость не задана</span>}
            </div>
          </div>
          {g.rows.length === 0 ? <div style={{ padding: 18 }}><State kind="empty" title="В этом фильтре строк нет" /></div> : <div className="oa-scroll"><table className="oa-table">
            <thead><tr><th scope="col">Товар</th><th scope="col">Срочность</th><th scope="col" className="num">Прогноз</th><th scope="col" className="num">Остаток</th><th scope="col" className="num">В пути</th><th scope="col" className="num oa-hide-sm">Страх. запас</th><th scope="col" className="num oa-hide-sm">Кратность</th><th scope="col" className="num">К заказу, шт</th><th scope="col" className="num">Стоимость</th></tr></thead>
            <tbody>{shown.map(r => { const uc = g.supplier_id === "SE" ? costs.get(r.code_1c) : null; return <RecRow key={r.id} row={r} open={openId === r.id || openId === `code:${r.code_1c}`} onToggle={onToggle} cost={uc ? lineCost(uc, r.qty_adjusted ?? r.qty_recommended) : null} />; })}</tbody>
          </table></div>}
          {g.rows.length > limit ? <div className="oa-more"><button type="button" className="oa-btn oa-btn-outline" onClick={() => setLimits(l => ({ ...l, [g.supplier_id]: limit + PAGE * 2 }))}>Показать ещё {qty(Math.min(PAGE * 2, g.rows.length - limit))} из {qty(g.rows.length - limit)}</button></div> : null}
        </section>;
      })}
    </div>
    {recs.data ? <p className="muted" style={{ font: "var(--oa-meta)" }}>Себестоимость есть только у SE («СС реал»); у IEK она не задана, поэтому сумма не считается.</p> : null}
  </main>;
}
