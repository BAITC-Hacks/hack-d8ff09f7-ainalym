"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Search, CircleAlert, PencilLine, Undo2, ArrowRight, ArrowUp, ArrowDown, ArrowUpDown, Mail, RefreshCw } from "lucide-react";
import { ApiError, apiRequest, useApi, useApiSync } from "@/components/shell/api";
import { Button, MiniBars, Pill, Skeleton, Sparkline, StateBlock, TruthStrip, UrgencyPill, URGENCY_RU, errorKind, errorTitle, fmtInt, fmtMoney, fmtNum, fmtYm, stakeTier, type Money, type Urgency } from "@/components/v2/primitives";
import { CartButton, CartPanel, type CartSupplier } from "@/components/v2/CartPanel";
import styles from "./replenishment.module.css";

type Components = { source_months?: number; sales_lines?: number; stock_month?: string; stock_stale?: boolean; transit_rows?: number; base_rate?: number; season_source?: string; season?: Record<string, number>; growth?: number; horizon_days?: number; forecast_qty?: number; monthly_forecast?: Record<string, number>; stockout_uplift?: number; safety?: number; on_hand?: number; on_hand_as_of?: string; in_transit?: number; in_transit_sources?: unknown[]; net_need?: number; raw_need?: number; moq?: number; days_of_cover?: number; outlier_threshold?: number; median_month_qty?: number; p95_doc_qty?: number; raw_observed_forecast?: number };
type Row = { id: string; code_1c: string; name: string; on_hand: string; in_transit: string; forecast_qty: string | null; qty_recommended: number; qty_adjusted: number | null; moq: number; urgency: Urgency; rationale_ru: string; components: Components; outliers_excluded: { doc_no?: string; qty?: string | number; rule?: string; ym?: string; threshold?: number }[]; stockout_months: string[]; image_url?: string | null; ekt_url?: string | null; ekt_stock_total?: number | string | null; ekt_stock_as_of?: string | null };
type Group = { supplier_id: string; total_qty: number; total_cost: Money | null; cost_known_lines: number; rows: Row[] };
type Recs = { ai: string; external: string; state_version: number; groups: Group[] };
type Proposals = { proposals: { id: string; kind: string; subject_id: string; state: string; version: number; money_at_stake: Money | null; payload?: { run_id?: string } }[] };
type Runs = { runs: { id: string; started_at: string; skus: number; recommended: number }[] };
type Skus = { items: { code_1c: string; unit_cost: string | null }[]; total: number };
type Orders = { orders: { id: string; supplier_id: string; state: string; created_at?: string | null }[] };
type Params = { suppliers?: { id: string; lead_time_days?: number | null; prepay_pct?: number }[] };
type CalcResult = { run_id: string; skus: number; recommended: number; partial?: boolean };
type SortKey = "name" | "urgency" | "on_hand" | "in_transit" | "forecast" | "qty" | "cost";
const SORT_KEYS: SortKey[] = ["name", "urgency", "on_hand", "in_transit", "forecast", "qty", "cost"];
const SORT_LABEL: Record<SortKey, string> = { name: "Позиция", urgency: "Срочность", on_hand: "Остаток", in_transit: "В пути", forecast: "Прогноз", qty: "Заказать", cost: "Стоимость" };
const URGENCY_RANK: Record<Urgency, number> = { critical: 0, soon: 1, normal: 2, none: 3 };
/** First click: text a→z, urgency critical-first, numbers largest-first; second click flips. */
const DEFAULT_DIR: Record<SortKey, "asc" | "desc"> = { name: "asc", urgency: "asc", on_hand: "desc", in_transit: "desc", forecast: "desc", qty: "desc", cost: "desc" };
const baseQty = (r: Row) => r.qty_adjusted ?? r.qty_recommended;
/** Presentation only: the engine text starts with «Код 1С …»; the UI names it «Артикул …». */
const humanRationale = (t: string) => t.replace(/^Код 1С\s+/, "Артикул ");

const PAGE = 50;
const URGENCIES: Urgency[] = ["critical", "soon", "normal"];

export default function ReplenishmentPage() { return <Suspense fallback={<div className={styles.page}><Skeleton rows={6} /></div>}><Replenishment /></Suspense>; }

function Replenishment() {
  const params = useSearchParams(); const router = useRouter();
  const supplier = params.get("supplier") ?? "";
  const urgency = (params.get("urgency") ?? "") as Urgency | "";
  const [sortKey, sortDir] = useMemo<[SortKey | "", "asc" | "desc"]>(() => { const [k, d] = (params.get("sort") ?? "").split(":"); return SORT_KEYS.includes(k as SortKey) ? [k as SortKey, d === "asc" ? "asc" : "desc"] : ["", "desc"]; }, [params]);
  const [query, setQuery] = useState(""); const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(true); // owner 12:06Z: the cart is visible by default (docked on wide screens)
  const [flash, setFlash] = useState<{ code: string; at: number } | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const { refresh } = useApiSync();

  const recs = useApi<Recs>("/api/recommendations");
  const proposals = useApi<Proposals>("/api/proposals?state=needs_review");
  const runs = useApi<Runs>("/api/calc/runs");
  const run = runs.data?.runs[0];
  const orders = useApi<Orders>("/api/orders");
  const paramsApi = useApi<Params>("/api/params");
  // Unit cost lives on the SKU (SE only — IEK has none); recommendation rows do not carry it.
  const seA = useApi<Skus>("/api/skus?supplier=SE&limit=500"); const seB = useApi<Skus>("/api/skus?supplier=SE&limit=500&offset=500");
  const costByCode = useMemo(() => { const m: Record<string, string> = {}; for (const i of [...(seA.data?.items ?? []), ...(seB.data?.items ?? [])]) if (i.unit_cost) m[i.code_1c] = i.unit_cost; return m; }, [seA.data, seB.data]);

  const setParam = useCallback((k: string, v: string) => { const p = new URLSearchParams(params.toString()); if (v) p.set(k, v); else p.delete(k); router.replace(`/replenishment${p.size ? `?${p}` : ""}`); setPage(0); }, [params, router]);

  const groups = useMemo(() => recs.data?.groups ?? [], [recs.data]);
  const all = useMemo(() => groups.flatMap(g => g.rows.map(r => ({ ...r, supplier: g.supplier_id }))), [groups]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = all.filter(r => (!supplier || r.supplier === supplier) && (!urgency || r.urgency === urgency) && (!q || r.name.toLowerCase().includes(q) || r.code_1c.toLowerCase().includes(q)));
    if (!sortKey) return rows;
    const dir = sortDir === "asc" ? 1 : -1;
    const key = (r: Row): string | number | null => sortKey === "name" ? r.name.replace(/\s+/g, " ").trim().toLowerCase() : sortKey === "urgency" ? URGENCY_RANK[r.urgency] : sortKey === "on_hand" ? Number(r.on_hand) : sortKey === "in_transit" ? Number(r.in_transit) : sortKey === "forecast" ? (r.forecast_qty == null ? null : Number(r.forecast_qty)) : sortKey === "qty" ? baseQty(r) : (costByCode[r.code_1c] ? Number(costByCode[r.code_1c]) * baseQty(r) : null);
    // Unknown values (no cost, no forecast) always sink to the bottom regardless of direction.
    return [...rows].sort((a, b) => { const ka = key(a), kb = key(b); if (ka == null && kb == null) return 0; if (ka == null) return 1; if (kb == null) return -1; if (typeof ka === "string" && typeof kb === "string") return ka.localeCompare(kb, "ru") * dir; return ((ka as number) - (kb as number)) * dir; });
  }, [all, supplier, urgency, query, sortKey, sortDir, costByCode]);
  const setSort = useCallback((k: SortKey) => { const next = sortKey === k ? (sortDir === "asc" ? "desc" : "asc") : DEFAULT_DIR[k]; setParam("sort", `${k}:${next}`); }, [sortKey, sortDir, setParam]);
  const supplierOrders = useMemo(() => (orders.data?.orders ?? []).filter(o => o.supplier_id === supplier).sort((a, b) => String(b.created_at ?? b.id).localeCompare(String(a.created_at ?? a.id))), [orders.data, supplier]);
  const pageRows = visible.slice(page * PAGE, page * PAGE + PAGE);
  const urgencyCounts = useMemo(() => all.filter(r => !supplier || r.supplier === supplier).reduce<Record<string, number>>((a, r) => { a[r.urgency] = (a[r.urgency] ?? 0) + 1; return a; }, {}), [all, supplier]);
  const group = groups.find(g => g.supplier_id === supplier);
  const proposal = proposals.data?.proposals.find(p => p.kind === "supplier_order" && p.subject_id === supplier && p.state === "needs_review");
  const draftCount = Object.keys(drafts).filter(code => group?.rows.some(r => r.code_1c === code)).length;
  // The cart = every supplier's open proposal lines with the manager's drafts on top (the same drafts «Подготовить заказ» applies).
  const cartSuppliers = useMemo<CartSupplier[]>(() => groups.map(g => {
    const p = paramsApi.data?.suppliers?.find(x => x.id === g.supplier_id);
    const prop = proposals.data?.proposals.find(x => x.kind === "supplier_order" && x.subject_id === g.supplier_id && x.state === "needs_review");
    return { id: g.supplier_id, proposalId: prop?.id ?? null, leadTimeDays: p?.lead_time_days ?? null, prepayPct: p?.prepay_pct ?? 30,
      lines: g.rows.map(r => { const base = r.qty_adjusted ?? r.qty_recommended; const d = drafts[r.code_1c]; const cost = costByCode[r.code_1c]; return { id: r.id, code: r.code_1c, name: r.name, qty: d ?? base, base, drafted: d !== undefined, unitCost: cost ? Number(cost) : null, urgency: r.urgency, image: r.image_url ?? null }; }) };
  }), [groups, drafts, costByCode, proposals.data, paramsApi.data]);
  const setDraft = useCallback((code: string, q: number | null) => setDrafts(d => { const n = { ...d }; if (q === null) delete n[code]; else n[code] = q; return n; }), []);
  const closeCart = useCallback(() => setCartOpen(false), []);
  const added = useCallback((code: string) => { setFlash({ code, at: Date.now() }); setCartOpen(true); }, []);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 2200); return () => clearTimeout(t); }, [flash]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null; const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
      if (e.key === "/" && !typing) { e.preventDefault(); search.current?.focus(); search.current?.select(); return; }
      if (typing) { if (e.key === "Escape") (t as HTMLElement).blur(); return; }
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const ids = pageRows.map(r => r.id); const cur = ids.findIndex(id => rowRefs.current.get(id) === document.activeElement);
        const next = e.key === "j" ? Math.min(ids.length - 1, cur + 1) : Math.max(0, cur === -1 ? 0 : cur - 1);
        rowRefs.current.get(ids[next])?.focus();
      }
      if (e.key === "Escape" && expanded) { const el = rowRefs.current.get(expanded); setExpanded(null); el?.focus(); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [pageRows, expanded]);

  const toggle = (id: string) => setExpanded(cur => cur === id ? null : id);
  const loading = recs.loading && !recs.data;

  return (
    <div className={`${styles.page} ${cartOpen ? styles.withCart : ""}`}>
      <p className={styles.eyebrow}>Закупки{run && <> · расчёт от {new Date(run.started_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {fmtInt(run.skus)} SKU просчитано</>}</p>
      <div className={styles.head}>
        <h1 className={styles.display}>Пополнение</h1>
        <div className={styles.headStack}>
          <CartButton suppliers={cartSuppliers} onClick={() => setCartOpen(true)} />
          <CalcRun supplier={supplier} run={run} onDone={() => { refresh(); recs.reload(); runs.reload(); proposals.reload(); }} />
          <PrepareOrder supplier={supplier} group={group} groups={groups} proposal={proposal} proposalsAll={proposals.data?.proposals ?? []} proposalsError={proposals.error} drafts={drafts} draftCount={draftCount} letterPo={supplierOrders[0]?.id ?? null} onDone={() => { setDrafts({}); refresh(); recs.reload(); proposals.reload(); orders.reload(); }} />
        </div>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Поставщик">
        {[{ id: "", label: "Все", n: all.length }, ...groups.map(g => ({ id: g.supplier_id, label: g.supplier_id, n: g.rows.length }))].map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={supplier === t.id} className={`${styles.tab} ${supplier === t.id ? styles.tabActive : ""}`} onClick={() => setParam("supplier", t.id)}>{t.label}{recs.data && <span className={styles.tabCount}>{fmtInt(t.n)}</span>}</button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <label className={styles.search}><Search size={15} aria-hidden="true" /><input ref={search} data-v2-search type="search" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} placeholder="Название или код 1С" aria-label="Фильтр по названию или коду 1С" /><kbd>/</kbd></label>
        <div className={styles.chips} role="group" aria-label="Срочность">
          {URGENCIES.map(u => <button key={u} type="button" aria-pressed={urgency === u} className={`${styles.chip} ${urgency === u ? styles.chipOn : ""}`} onClick={() => setParam("urgency", urgency === u ? "" : u)}><UrgencyPill value={u} /><span className={styles.chipN}>{fmtInt(urgencyCounts[u] ?? 0)}</span></button>)}
        </div>
        {group && <p className={styles.groupSum}><span>{fmtInt(group.rows.length)} позиций · {fmtInt(group.total_qty)} шт</span>{group.total_cost ? <span className={styles.groupMoney}>{fmtMoney(group.total_cost)} <em>цена известна для {group.cost_known_lines} из {group.rows.length}</em></span> : <span className={styles.groupNone}>Себестоимость не задана</span>}</p>}
      </div>

      {loading && <div className={styles.tableWrap}><Skeleton rows={8} height={40} /></div>}
      {recs.error && !recs.data && <StateBlock kind={errorKind(recs.error)} title={errorTitle(recs.error)} detail={recs.error.message} action={<Button onClick={recs.reload}>Повторить</Button>} />}
      {recs.data && groups.length === 0 && <EmptyRun onDone={() => { refresh(); recs.reload(); runs.reload(); proposals.reload(); }} />}
      {recs.data && groups.length > 0 && visible.length === 0 && <StateBlock kind="empty" title="Ничего не найдено по фильтру" detail="Снимите срочность или очистите поиск." action={<Button variant="quiet" onClick={() => { setQuery(""); setParam("urgency", ""); }}>Сбросить</Button>} />}

      {pageRows.length > 0 && (
        <div className={styles.tableWrap} data-stale={recs.error ? "1" : undefined}>
          {recs.error && <div className={styles.staleBar} role="status"><CircleAlert size={14} aria-hidden="true" />{errorTitle(recs.error)} — показываю последний снимок</div>}
          <table className={styles.table}>
            <thead><tr><th className={styles.thChevron} aria-label="Раскрыть" />{SORT_KEYS.map(k => {
              const on = sortKey === k; const asc = on && sortDir === "asc";
              return <th key={k} className={k === "name" || k === "urgency" ? undefined : styles.num} aria-sort={on ? (asc ? "ascending" : "descending") : "none"}>
                <button type="button" className={`${styles.sortBtn} ${on ? styles.sortOn : ""}`} onClick={() => setSort(k)} title={on ? (asc ? "По возрастанию — нажмите, чтобы перевернуть" : "По убыванию — нажмите, чтобы перевернуть") : "Сортировать"}>
                  {SORT_LABEL[k]}{on ? (asc ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />) : <ArrowUpDown size={12} className={styles.sortIdle} aria-hidden="true" />}
                  <span className={styles.srUrgency}>{on ? (asc ? " — по возрастанию" : " — по убыванию") : " — сортировать"}</span>
                </button></th>;
            })}</tr></thead>
            <tbody>
              {pageRows.map(r => {
                const open = expanded === r.id; const c = r.components; const draft = drafts[r.code_1c]; const qty = draft ?? r.qty_adjusted ?? r.qty_recommended;
                const cost = costByCode[r.code_1c] ?? null; const line = cost ? { amount: (Number(cost) * qty).toFixed(2), currency: "KZT" } : null;
                return [
                  <tr key={r.id} ref={el => { if (el) rowRefs.current.set(r.id, el); else rowRefs.current.delete(r.id); }} tabIndex={0} role="button" aria-expanded={open} aria-controls={`x-${r.id}`} className={`${styles.row} ${open ? styles.rowOpen : ""} ${draft !== undefined ? styles.rowDraft : ""}`} onClick={() => toggle(r.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(r.id); } }}>
                    <td className={styles.tdChevron}><ChevronRight size={16} className={styles.chevron} aria-hidden="true" /></td>
                    <td className={r.image_url ? styles.tdWithThumb : undefined}>{r.image_url && <img src={r.image_url} alt="" className={styles.thumb} loading="lazy" width={26} height={26} />}<span className={styles.name}>{r.name.replace(/\s+/g, " ")}</span><span className={styles.meta}>{r.code_1c} · {r.supplier}{r.moq > 1 && ` · кратность ${r.moq}`}{c.days_of_cover != null && ` · покрытие ${fmtNum(c.days_of_cover, 0)} дн`}</span></td>
                    <td><UrgencyPill value={r.urgency} /></td>
                    <td className={styles.num} title={c.on_hand_as_of ? `Остаток на ${c.on_hand_as_of}` : undefined}><span>{fmtInt(r.on_hand)}</span><span className={styles.meta}>{c.on_hand_as_of ? `на ${c.on_hand_as_of.slice(5).replace("-", ".")}` : "дата неизвестна"}{c.stock_stale && " · устарел"}</span></td>
                    <td className={styles.num}><span>{fmtInt(r.in_transit)}</span><span className={styles.meta}>{c.transit_rows ? `${c.transit_rows} поставок` : "нет поставок"}</span></td>
                    <td className={styles.num} title={`Прогноз на ${c.horizon_days ?? "—"} дн + страховой запас ${fmtNum(c.safety)}`}><span>{fmtNum(r.forecast_qty)}</span><span className={styles.meta}>на {c.horizon_days ?? "—"} дн</span></td>
                    <td className={`${styles.num} ${styles.qty}`} data-stake={stakeTier(line?.amount)}><span className={styles.qtyValue}>{fmtInt(qty)}{draft !== undefined && <PencilLine size={13} className={styles.draftMark} aria-label="в корзине" />}</span><span className={styles.meta}>{draft !== undefined ? `в корзине · было ${fmtInt(r.qty_adjusted ?? r.qty_recommended)}` : r.qty_adjusted != null ? `скорректировано · расчёт ${fmtInt(r.qty_recommended)}` : "по расчёту"}</span></td>
                    <td className={styles.num} data-stake={stakeTier(line?.amount)}>{line ? <><span>{fmtMoney(line)}</span><span className={styles.meta}>{fmtMoney({ amount: cost!, currency: "KZT" })} / шт</span></> : <span className={styles.none}>не задана</span>}</td>
                  </tr>,
                  open && <tr key={`${r.id}-x`} id={`x-${r.id}`} className={styles.detailRow}><td colSpan={8}><Rationale r={r} draft={draft} onDraft={q => setDraft(r.code_1c, q)} onAdded={() => added(r.code_1c)} /></td></tr>,
                ];
              })}
            </tbody>
          </table>
          <div className={styles.pager}>
            <span>{fmtInt(page * PAGE + 1)}–{fmtInt(Math.min(visible.length, (page + 1) * PAGE))} из {fmtInt(visible.length)} позиций · Σ {fmtInt(visible.reduce((a, r) => a + (drafts[r.code_1c] ?? r.qty_adjusted ?? r.qty_recommended), 0))} шт</span>
            <span className={styles.pagerBtns}><Button variant="quiet" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Назад</Button><Button variant="quiet" disabled={(page + 1) * PAGE >= visible.length} onClick={() => setPage(p => p + 1)}>Дальше</Button></span>
          </div>
        </div>
      )}
      <p className={styles.keys}><kbd>/</kbd> поиск · <kbd>j</kbd>/<kbd>k</kbd> по строкам · <kbd>Enter</kbd> раскрыть · <kbd>Esc</kbd> закрыть</p>
      <footer className={styles.foot}><TruthStrip ai={recs.data?.ai} external={recs.data?.external} /></footer>
      <CartPanel open={cartOpen} onClose={closeCart} suppliers={cartSuppliers} highlight={flash} onQty={(_s, code, q) => setDraft(code, q)} />
    </div>
  );
}

function CalcRun({ supplier, run, onDone }: { supplier: string; run?: Runs["runs"][number]; onDone: () => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState<ApiError | null>(null); const [result, setResult] = useState<CalcResult | null>(null);
  useEffect(() => { setError(null); setResult(null); }, [supplier]);
  const go = async () => {
    setBusy(true); setError(null); setResult(null);
    try { setResult(await apiRequest<CalcResult>("/api/calc/run", { method: "POST", body: JSON.stringify({ scope: supplier ? { supplier } : {} }) })); onDone(); }
    catch (e) { setError(e instanceof ApiError ? e : new ApiError(500, "unknown", "Расчёт не выполнен")); }
    finally { setBusy(false); }
  };
  const when = run ? new Date(run.started_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <div className={styles.calcRow}>
      {busy ? <span className={styles.headNote} role="status" aria-live="polite"><RefreshCw size={13} className={styles.spin} aria-hidden="true" />Считаю потребность{supplier ? ` по ${supplier}` : " по всем поставщикам"} — это занимает до минуты</span>
        : result ? <span className={`${styles.headAlert} ${styles.ok}`} role="status">Рассчитано {fmtInt(result.skus)} позиций, рекомендаций {fmtInt(result.recommended)}{result.partial ? " · часть позиций без истории" : ""}</span>
        : error ? <span className={`${styles.headAlert} ${styles.err}`} role="alert"><CircleAlert size={14} aria-hidden="true" />{error.message}</span>
        : <span className={styles.headNote}>{when ? `Последний расчёт ${when}` : "Расчёт пока не запускался"}</span>}
      <Button variant={run ? "secondary" : "primary"} busy={busy} disabled={busy} onClick={go} title={busy ? "Расчёт уже идёт — дождитесь результата" : supplier ? `Пересчитать потребность по ${supplier}` : "Пересчитать потребность по всем поставщикам"}>{run ? "Пересчитать" : "Рассчитать заказы"}{supplier && ` · ${supplier}`}</Button>
    </div>
  );
}

function PrepareOrder({ supplier, group, groups, proposal, proposalsAll, proposalsError, drafts, draftCount, letterPo, onDone }: { supplier: string; group?: Group; groups: Group[]; proposal?: Proposals["proposals"][number]; proposalsAll: Proposals["proposals"]; proposalsError: ApiError | null; drafts: Record<string, number>; draftCount: number; letterPo: string | null; onDone: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false); const [error, setError] = useState<ApiError | null>(null); const [receipt, setReceipt] = useState(""); const [receiptPo, setReceiptPo] = useState<string | null>(null);
  useEffect(() => { setError(null); setReceipt(""); setReceiptPo(null); }, [supplier]);
  if (!supplier) {
    // «Все»: one order button per supplier with its line count → opens that supplier's proposal (or its tab when no proposal waits).
    return (
      <div className={styles.headActions}>
        <span className={styles.headNote}>Заказ готовится по каждому поставщику отдельно</span>
        {groups.map(g => { const p = proposalsAll.find(x => x.kind === "supplier_order" && x.subject_id === g.supplier_id && x.state === "needs_review");
          return <Button key={g.supplier_id} variant="primary" onClick={() => router.push(p ? `/review/${encodeURIComponent(p.id)}` : `/replenishment?supplier=${encodeURIComponent(g.supplier_id)}`)} title={p ? `Открыть предложение по ${g.supplier_id}` : `Открыть закупки ${g.supplier_id}`}>Подготовить заказ {g.supplier_id}<span className={styles.btnCount}>{fmtInt(g.rows.length)} строк</span></Button>; })}
      </div>
    );
  }
  const submit = async () => {
    if (!proposal || !group) return;
    setBusy(true); setError(null);
    const adjustments = Object.entries(drafts).filter(([code]) => group.rows.some(r => r.code_1c === code)).map(([code_1c, qty]) => ({ code_1c, qty }));
    try {
      const r = await apiRequest<{ po_id?: string; proposal_version: number }>(`/api/proposals/${encodeURIComponent(proposal.id)}/approve`, { method: "POST", body: JSON.stringify({ proposal_version: proposal.version, ...(adjustments.length ? { adjustments } : {}) }) });
      setReceipt(`Черновик заказа — не отправлен${r.po_id ? ` · ${r.po_id}` : ""}${adjustments.length ? ` · корректировок: ${adjustments.length}` : ""}`); setReceiptPo(r.po_id ?? null); onDone();
    } catch (e) { setError(e instanceof ApiError ? e : new ApiError(500, "unknown", "Действие не выполнено")); if (e instanceof ApiError && e.status === 409) onDone(); }
    finally { setBusy(false); }
  };
  const po = receiptPo ?? letterPo;
  return (
    <div className={styles.headActions}>
      {receipt ? <span className={`${styles.headAlert} ${styles.ok}`} role="status">{receipt}</span>
        : error ? <span className={`${styles.headAlert} ${error.status === 409 ? styles.stale : styles.err}`} role="alert"><CircleAlert size={14} aria-hidden="true" />{error.status === 409 ? "Данные обновились — предложение изменилось, список перечитан" : error.message}</span>
        : proposalsError ? <span className={`${styles.headAlert} ${styles.err}`}>Предложения недоступны — {proposalsError.message}</span>
        : !proposal ? <span className={styles.headNote}>Для {supplier} нет предложения «ждёт вас»</span>
        : <span className={styles.headNote}>Версия {proposal.version}{proposal.money_at_stake ? ` · ${fmtMoney(proposal.money_at_stake, true)}` : " · Себестоимость не задана"}</span>}
      <Button variant="primary" busy={busy} disabled={!proposal || !!receipt} onClick={submit} title="Создаст внутренний черновик заказа; ничего не отправляется поставщику">Подготовить заказ {supplier}{draftCount > 0 && <span className={styles.btnCount}>{draftCount}</span>}</Button>
      {po ? <Link href={`/orders/${encodeURIComponent(po)}`} prefetch={false} className={styles.letterLink} title="Откроет черновик письма — ничего не отправляется автоматически"><Mail size={14} aria-hidden="true" />Подготовить сообщение поставщику</Link>
        : <Button variant="secondary" disabled title="Сначала подготовьте заказ — письмо составляется по нему"><Mail size={14} aria-hidden="true" />Подготовить сообщение поставщику</Button>}
    </div>
  );
}

function EmptyRun({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState<ApiError | null>(null);
  const runCalc = async () => { setBusy(true); setError(null); try { await apiRequest("/api/calc/run", { method: "POST", body: "{}" }); onDone(); } catch (e) { setError(e instanceof ApiError ? e : new ApiError(500, "unknown", "Расчёт не выполнен")); } finally { setBusy(false); } };
  return <StateBlock kind="empty" title="Расчёт ещё не запускался" detail={error ? error.message : "Агент просчитает потребность по всем источникам: продажи, сезонность, рост, дефицит, разовые документы, в пути, кратность."} action={<Button variant="primary" busy={busy} onClick={runCalc}>Запустить расчёт</Button>} />;
}

function Rationale({ r, draft, onDraft, onAdded }: { r: Row & { supplier: string }; draft?: number; onDraft: (q: number | null) => void; onAdded: () => void }) {
  const c = r.components; const [val, setVal] = useState<string>(String(draft ?? r.qty_adjusted ?? r.qty_recommended));
  const months = Object.entries(c.monthly_forecast ?? {}).map(([k, v]) => ({ k: fmtYm(k), v }));
  const season = c.season ? Array.from({ length: 12 }, (_, i) => c.season![String(i + 1)] ?? 1) : null;
  const apply = () => { const n = Math.max(0, Math.round(Number(val))); if (!Number.isFinite(n)) return; if (n === (r.qty_adjusted ?? r.qty_recommended)) onDraft(null); else onDraft(n); onAdded(); };
  return (
    <div className={styles.detail} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
      <div className={styles.detailCols}>
        <section className={styles.formula} aria-label="Как получилось число">
          <h3 className={styles.detailH}>Как получилось число</h3>
          <ol className={styles.terms}>
            <li><span className={styles.termV}>{fmtNum(c.forecast_qty ?? r.forecast_qty, 2)}</span><span className={styles.termL}>прогноз на {c.horizon_days} дн</span><span className={styles.termS}>{fmtNum(c.base_rate, 2)} шт/мес × сезонность ({c.season_source === "sku" ? "по SKU" : "по поставщику"}) × рост ×{fmtNum(c.growth, 2)}</span></li>
            <li><span className={styles.termOp}>+</span><span className={styles.termV}>{fmtNum(c.safety, 2)}</span><span className={styles.termL}>страховой запас</span><span className={styles.termS}>чтобы покрыть 90 % колебаний спроса</span></li>
            <li><span className={styles.termOp}>−</span><span className={styles.termV}>{fmtInt(c.on_hand ?? r.on_hand)}</span><span className={styles.termL}>остаток</span><span className={styles.termS}>на {c.on_hand_as_of ?? "—"} · месяц {c.stock_month ?? "—"}{c.stock_stale ? " · устарел" : ""}</span></li>
            <li><span className={styles.termOp}>−</span><span className={styles.termV}>{fmtInt(c.in_transit ?? r.in_transit)}</span><span className={styles.termL}>в пути</span><span className={styles.termS}>{c.transit_rows ? `${c.transit_rows} поставок` : "открытых поставок нет"}</span></li>
            <li className={styles.termResult}><span className={styles.termOp}>=</span><span className={styles.termV}>{fmtNum(c.net_need, 2)}</span><span className={styles.termL}>потребность</span><span className={styles.termS}>кратность {r.moq} → <strong>{fmtInt(r.qty_recommended)} шт</strong>{r.qty_adjusted != null && ` · вы скорректировали до ${fmtInt(r.qty_adjusted)}`}</span></li>
          </ol>
          <ul className={styles.sourcesList} aria-label="На чём основан расчёт">
            <li>обычные продажи: {fmtNum(c.median_month_qty)} шт в месяц (медиана за {c.source_months ?? "—"} мес)</li>
            <li>разовые заказы: крупнее {fmtNum(c.outlier_threshold)} шт считаем разовыми и не включаем в регулярный спрос</li>
            <li>строк продаж: {fmtInt(c.sales_lines)}</li>
          </ul>
        </section>
        <section className={styles.viz} aria-label="Прогноз по месяцам">
          <h3 className={styles.detailH}>Прогноз по месяцам</h3>
          {months.length ? <MiniBars points={months} label="Прогноз по месяцам, шт" tone="a" /> : <p className={styles.none}>нет помесячного прогноза</p>}
          {season && <div className={styles.seasonRow}><Sparkline values={season} tone="b" /><span className={styles.meta}>индекс сезонности, 12 мес · {c.season_source === "sku" ? "собственная история" : "выручка поставщика"}</span></div>}
          <div className={styles.flags}>
            {r.stockout_months.length > 0 ? <Pill tone="warn">без продаж из-за отсутствия остатка: {r.stockout_months.map(fmtYm).join(", ")}</Pill> : <Pill tone="neutral">дефицита в истории нет</Pill>}
            {r.outliers_excluded.length > 0 ? r.outliers_excluded.map((o, i) => <Pill key={i} tone="danger">исключено: документ {o.doc_no ?? "—"} · {fmtInt(o.qty)} шт{o.ym ? ` · ${fmtYm(o.ym)}` : ""}</Pill>) : <Pill tone="neutral">разовых документов нет</Pill>}
          </div>
        </section>
      </div>
      <section aria-label="Пояснение расчёта"><h3 className={styles.detailH}>Пояснение расчёта</h3><p className={styles.rationaleText}>{humanRationale(r.rationale_ru)}</p></section>
      {r.ekt_stock_total != null && <p className={styles.ektLine}>На складе ekt.kz сейчас: {fmtInt(r.ekt_stock_total)} ({r.ekt_stock_as_of ? `снимок от ${r.ekt_stock_as_of}` : "живой API"}){r.ekt_url && <> · <a href={r.ekt_url} target="_blank" rel="noreferrer">ekt.kz</a></>}</p>}
      <div className={styles.adjust}>
        <label className={styles.adjustLabel} htmlFor={`adj-${r.id}`}>Скорректировать количество</label>
        <input id={`adj-${r.id}`} type="number" min={0} step={r.moq} inputMode="numeric" className={styles.adjustInput} value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); apply(); } }} />
        <Button variant="dark" onClick={apply}>Добавить в корзину</Button>
        {draft !== undefined && <Button variant="quiet" onClick={() => { onDraft(null); setVal(String(r.qty_adjusted ?? r.qty_recommended)); }}><Undo2 size={14} aria-hidden="true" />Вернуть расчёт</Button>}
        <span className={styles.adjustNote}>{draft !== undefined ? `В корзине ${fmtInt(draft)} шт — попадёт в заказ поставщику ${r.supplier} при «Подготовить заказ»` : "Попадёт в заказ поставщику"}</span>
        <Link href={`/skus/${encodeURIComponent(r.code_1c)}`} prefetch={false} className={styles.skuLink}>Карточка SKU<ArrowRight size={13} aria-hidden="true" /></Link>
      </div>
      <p className={styles.srUrgency}>Срочность: {URGENCY_RU[r.urgency]}</p>
    </div>
  );
}
