"use client";
import Link from "next/link";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronRight, Search, TriangleAlert } from "lucide-react";
import { apiRequest, ApiError, useApi, useApiSync } from "@/components/shell/api";
import type { TruthAxes } from "@/components/labels";
import { formatMinor, lineCost, money, plural, qty, type Money } from "./format";
import { ErrorState, Skel, State, Truth, UrgencyPill, URGENCY_ORDER, type ApiErr } from "./ui";
import { Exclusions, Forecast, Receipt, type Components } from "./rationale";

type Row = { id: string; code_1c: string; name: string; on_hand: string; in_transit: string; forecast_qty: string | null; qty_recommended: number; qty_adjusted: number | null; moq: number; urgency: string; rationale_ru: string; components: Components; stockout_months: string[] };
type Group = { supplier_id: string; total_qty: number; total_cost: Money | null; cost_known_lines: number; rows: Row[] };
type RecResp = TruthAxes & { groups: Group[]; state_version: number };
type SkuList = { items: { code_1c: string; unit_cost: string | null }[]; total: number };
type SkuDetail = { recommendation?: { id: string; version: number; state: string; qty_recommended: number; qty_adjusted: number | null } | null };
const TABS = [["all", "Все"], ["critical", "Критично"], ["soon", "Скоро"], ["normal", "Планово"]] as const;
const PAGE = 40;
const asErr = (e: unknown): ApiErr => e instanceof ApiError ? { status: e.status, code: e.code, message: e.message } : { status: 500, code: "unknown", message: "Не удалось выполнить действие." };

function AdjustForm({ row, onClose }: { row: Row; onClose: () => void }) {
  const { refresh } = useApiSync();
  const detail = useApi<SkuDetail>(`/api/skus/${encodeURIComponent(row.code_1c)}`);
  const current = row.qty_adjusted ?? row.qty_recommended;
  const [value, setValue] = useState(String(current));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiErr>(null);
  const [done, setDone] = useState("");
  const rec = detail.data?.recommendation;
  const n = Number(value);
  const invalid = !Number.isInteger(n) || n < 0;
  const offMoq = !invalid && row.moq > 1 && n % row.moq !== 0;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (invalid || !reason.trim() || !rec) return;
    setBusy(true); setError(null); setDone("");
    try {
      await apiRequest(`/api/recommendations/${encodeURIComponent(row.id)}/adjust`, { method: "POST", body: JSON.stringify({ qty: n, reason: reason.trim(), version: rec.version }) });
      setDone(`Сохранено: ${qty(current)} → ${qty(n)} шт. Рекомендация агента осталась в истории.`); setReason(""); refresh();
    } catch (err) { setError(asErr(err)); } finally { setBusy(false); }
  }
  return <form className="oa-adjust" onSubmit={submit} aria-label={`Изменить количество ${row.code_1c}`}>
    <label className="oa-field qty">Количество, шт<input inputMode="numeric" value={value} onChange={e => setValue(e.target.value.replace(/[^\d]/g, ""))} aria-invalid={invalid} /></label>
    <label className="oa-field reason">Причина (обязательно)<input value={reason} onChange={e => setReason(e.target.value)} placeholder="Например: клиент перенёс заказ на ноябрь" /></label>
    <button type="submit" className="oa-btn oa-btn-black" disabled={busy || invalid || !reason.trim() || !rec}>{busy ? "Сохраняю…" : "Сохранить"}</button>
    <button type="button" className="oa-btn oa-btn-ghost" onClick={onClose}>Свернуть <span className="oa-kbd" aria-hidden>Esc</span></button>
    <span className="muted" style={{ font: "var(--oa-meta)", flexBasis: "100%" }}>{rec ? `Изменение привязано к версии рекомендации v${rec.version}.` : detail.error ? "Версия рекомендации не получена — сохранение недоступно." : "Получаю версию рекомендации…"}{offMoq ? ` Не кратно ${row.moq} — поставщик может не принять.` : ""}</span>
    {done ? <div style={{ flexBasis: "100%" }}><State kind="ok" title={done} /></div> : null}
    {error ? <div style={{ flexBasis: "100%" }}>{error.status === 404 ? <State kind="unavailable" title="Сохранение корректировки недоступно">Сервер не нашёл маршрут изменения количества. Количество не изменено; ваше значение и причина остались в форме.</State> : <ErrorState error={error} onRetry={error.status === 409 ? () => { setError(null); detail.reload(); } : undefined} />}</div> : null}
  </form>;
}

const RecRow = memo(function RecRow({ row, cost, open, onToggle }: { row: Row; cost: bigint | null; open: boolean; onToggle: (id: string, toggleEl?: HTMLElement | null) => void }) {
  const c = row.components;
  const toggle = useRef<HTMLButtonElement>(null);
  return <>
    <tr className="oa-row" data-open={open}>
      <td style={{ minWidth: 280 }}>
        <button ref={toggle} type="button" className="oa-rowbtn" data-row-toggle aria-expanded={open} aria-controls={`why-${row.id}`} onClick={() => onToggle(row.id)}>
          <ChevronRight size={16} aria-hidden /><span><span className="n">{row.name}</span><span className="c">{row.code_1c}{c.days_of_cover !== undefined ? ` · покрытие ${qty(c.days_of_cover, 1)} дн` : ""}</span></span>
        </button>
      </td>
      <td><UrgencyPill urgency={row.urgency} /></td>
      <td className="num">{qty(row.forecast_qty)}</td>
      <td className="num">{qty(row.on_hand)}</td>
      <td className="num">{qty(row.in_transit)}</td>
      <td className="num oa-hide-sm">{qty(c.safety)}</td>
      <td className="num oa-hide-sm">{qty(row.moq)}</td>
      <td className="num"><span className="oa-qty">{row.qty_adjusted !== null && row.qty_adjusted !== row.qty_recommended ? <><s>{qty(row.qty_recommended)}</s>{qty(row.qty_adjusted)}</> : qty(row.qty_recommended)}</span></td>
      <td className="num">{cost !== null ? formatMinor(cost) : <span className="oa-nocost">себестоимость не задана</span>}</td>
    </tr>
    {c.stock_stale ? <tr className="oa-alert-row"><td colSpan={9}><TriangleAlert size={13} aria-hidden style={{ verticalAlign: -2, marginRight: 6 }} />Остаток устарел: последнее подтверждение {c.stock_month ?? "—"}. Проверьте склад перед заказом.</td></tr> : null}
    {open ? <tr className="oa-why" id={`why-${row.id}`}><td colSpan={9} onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); onToggle(row.id, toggle.current); } }}>
      <div className="oa-why-in">
        <div><h4>Из чего сложилось количество</h4><Receipt c={c} recommended={row.qty_recommended} adjusted={row.qty_adjusted} /></div>
        <Forecast c={c} />
        <Exclusions c={c} code={row.code_1c} />
        <p className="oa-engine-text">Текст расчёта: {row.rationale_ru}</p>
        <AdjustForm row={row} onClose={() => onToggle(row.id, toggle.current)} />
      </div>
    </td></tr> : null}
  </>;
});

export function ReplenishmentView({ supplier }: { supplier?: string }) {
  const path = supplier ? `/api/recommendations?supplier=${encodeURIComponent(supplier)}` : "/api/recommendations";
  const recs = useApi<RecResp>(path);
  const needSe = !supplier || supplier === "SE";
  const se1 = useApi<SkuList>(needSe ? "/api/skus?supplier=SE&limit=500&offset=0" : "/api/skus?supplier=SE&limit=1");
  const se2 = useApi<SkuList>(needSe ? "/api/skus?supplier=SE&limit=500&offset=500" : "/api/skus?supplier=SE&limit=1&offset=1");
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const tableRef = useRef<HTMLDivElement>(null);
  const costs = useMemo(() => new Map([...(se1.data?.items ?? []), ...(se2.data?.items ?? [])].map(s => [s.code_1c, s.unit_cost])), [se1.data, se2.data]);
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (recs.data?.groups ?? []).map(g => {
      const matched = g.rows.filter(r => !term || r.name.toLowerCase().includes(term) || r.code_1c.includes(term));
      const counts = { all: matched.length, critical: 0, soon: 0, normal: 0 } as Record<string, number>;
      matched.forEach(r => { counts[r.urgency] = (counts[r.urgency] ?? 0) + 1; });
      const rows = matched.filter(r => tab === "all" || r.urgency === tab).sort((a, b) => (URGENCY_ORDER[a.urgency] ?? 9) - (URGENCY_ORDER[b.urgency] ?? 9) || (a.components.days_of_cover ?? 0) - (b.components.days_of_cover ?? 0));
      return { ...g, rows, counts };
    });
  }, [recs.data, q, tab]);
  const totals = useMemo(() => groups.reduce((acc, g) => { Object.entries(g.counts).forEach(([k, v]) => { acc[k] = (acc[k] ?? 0) + v; }); return acc; }, {} as Record<string, number>), [groups]);
  const onToggle = useCallback((id: string, focusEl?: HTMLElement | null) => { setOpenId(cur => cur === id ? null : id); if (focusEl) requestAnimationFrame(() => focusEl.focus()); }, []);
  const onKeyNav = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    const target = e.target as HTMLElement;
    if (!target.matches("[data-row-toggle]")) return;
    const all = Array.from(tableRef.current?.querySelectorAll<HTMLElement>("[data-row-toggle]") ?? []);
    const i = all.indexOf(target);
    const next = e.key === "Home" ? all[0] : e.key === "End" ? all[all.length - 1] : all[i + (e.key === "ArrowDown" ? 1 : -1)];
    if (next) { e.preventDefault(); next.focus(); next.scrollIntoView({ block: "nearest" }); }
  };
  const seg = [["", "Все поставщики"], ["IEK", "IEK"], ["SE", "SE"]] as const;
  return <main className="oa-page" id="main">
    <div className="oa-head">
      <div><div className="oa-crumb"><Link href="/opus_a/today">Сегодня</Link> / Закупки</div><h1>Пополнение</h1></div>
      <div className="oa-head-actions"><Link href="/opus_a/today" className="oa-btn oa-btn-primary">К решению по заказам<ArrowRight size={16} aria-hidden /></Link></div>
    </div>
    <div style={{ display: "grid", gap: 10 }}>
      <p className="oa-lead">Сколько заказать у каждого поставщика: прогноз на срок поставки + страховой запас − остаток − в пути, с округлением до кратности. Откройте строку — там все числа расчёта.</p>
      <Truth axes={recs.data} />
    </div>
    <div role="tablist" aria-label="Срочность" className="oa-tabs">
      {TABS.map(([key, label]) => <button key={key} role="tab" type="button" aria-selected={tab === key} onClick={() => setTab(key)}>{label}<span className="c">{recs.data ? qty(totals[key] ?? 0) : "…"}</span></button>)}
    </div>
    <div className="oa-toolbar">
      <label className="oa-filter"><Search size={15} aria-hidden /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Фильтр по названию или коду 1С" aria-label="Фильтр по названию или коду 1С" /></label>
      <nav className="oa-seg" aria-label="Поставщик">{seg.map(([id, label]) => <Link key={id || "all"} aria-current={(supplier ?? "") === id ? "true" : undefined} href={id ? `/opus_a/replenishment?supplier=${id}` : "/opus_a/replenishment"}>{label}</Link>)}</nav>
      <span className="muted" style={{ font: "var(--oa-meta)", marginLeft: "auto" }}>↑ ↓ — по строкам · Enter — расчёт · Esc — свернуть</span>
    </div>
    {recs.error && !recs.data ? <ErrorState error={recs.error} onRetry={recs.reload} /> : null}
    {recs.loading && !recs.data ? <div className="oa-group"><div className="oa-group-head"><Skel w={160} h={22} /></div>{Array.from({ length: 8 }, (_, i) => <div key={i} style={{ padding: "16px 18px", borderTop: "1px solid var(--oa-line-soft)" }}><Skel h={20} /></div>)}</div> : null}
    {recs.data && groups.length === 0 ? <State kind="empty" title="Рекомендаций нет">Запустите расчёт — рекомендации появятся здесь, сгруппированные по поставщикам.</State> : null}
    <div ref={tableRef} onKeyDown={onKeyNav} style={{ display: "grid", gap: 28 }}>
      {groups.map(g => {
        const limit = limits[g.supplier_id] ?? PAGE;
        const shown = g.rows.slice(0, limit);
        return <section key={g.supplier_id} className="oa-group" aria-label={`Поставщик ${g.supplier_id}`}>
          <div className="oa-group-head">
            <h2>{g.supplier_id}</h2>
            <span className="muted" style={{ font: "var(--oa-meta)" }}>{qty(g.counts.all)} {plural(g.counts.all, "позиция", "позиции", "позиций")} · {qty(g.total_qty)} шт</span>
            <div className="sum">
              {g.total_cost ? <span><strong>{money(g.total_cost)}</strong> <span className="muted" style={{ font: "var(--oa-meta)" }}>цена известна для {qty(g.cost_known_lines)} из {qty(g.counts.all)}</span></span> : <span className="oa-nocost">себестоимость не задана</span>}
            </div>
          </div>
          {g.rows.length === 0 ? <div style={{ padding: 18 }}><State kind="empty" title="В этом фильтре строк нет" /></div> : <div className="oa-scroll"><table className="oa-table">
            <thead><tr><th scope="col">Товар</th><th scope="col">Срочность</th><th scope="col" className="num">Прогноз</th><th scope="col" className="num">Остаток</th><th scope="col" className="num">В пути</th><th scope="col" className="num oa-hide-sm">Страх. запас</th><th scope="col" className="num oa-hide-sm">Кратность</th><th scope="col" className="num">К заказу, шт</th><th scope="col" className="num">Стоимость</th></tr></thead>
            <tbody>{shown.map(r => { const uc = g.supplier_id === "SE" ? costs.get(r.code_1c) : null; return <RecRow key={r.id} row={r} open={openId === r.id} onToggle={onToggle} cost={uc ? lineCost(uc, r.qty_adjusted ?? r.qty_recommended) : null} />; })}</tbody>
          </table></div>}
          {g.rows.length > limit ? <div className="oa-more"><button type="button" className="oa-btn oa-btn-outline" onClick={() => setLimits(l => ({ ...l, [g.supplier_id]: limit + PAGE * 2 }))}>Показать ещё {qty(Math.min(PAGE * 2, g.rows.length - limit))} из {qty(g.rows.length - limit)}</button></div> : null}
        </section>;
      })}
    </div>
    {recs.data ? <p className="muted" style={{ font: "var(--oa-meta)" }}>Себестоимость есть только у SE («СС реал»); у IEK она не задана, поэтому сумма не считается.</p> : null}
  </main>;
}
