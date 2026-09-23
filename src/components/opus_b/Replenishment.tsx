"use client";
import Link from "next/link";
import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUpRight, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { ApiError, apiRequest, useApi } from "@/components/shell/api";
import { LABELS } from "@/components/labels";
import { Btn, btnClass, Kbd, Mark, Receipt, Skel, StateBlock, Truth, UrgencyPill, srOnly } from "./ui";
import { OneOffPanel, SeasonPanel, SourcesLine, StockoutPanel, Tape } from "./Rationale";
import { int, lineCost, money, plural, qty, toNum } from "./format";
import type { Axes, RecGroup, RecResponse, RecRow, SkuList, Urgency } from "./types";
import s from "./replenishment.module.css";

const PAGE = 50;
const COLS = 10;
const RANK: Record<string, number> = { critical: 0, soon: 1, normal: 2, none: 3 };
const SUPPLIER: Record<string, string> = { SE: "System Electric", IEK: "IEK" };
const FILTERS: Urgency[] = ["critical", "soon", "normal"];
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
type CostInfo = { unit_cost: string | null; article: string | null };
type CostState = "loading" | "ready" | "unavailable";

function byUrgency(a: RecRow, b: RecRow) {
  const r = (RANK[a.urgency] ?? 9) - (RANK[b.urgency] ?? 9);
  if (r) return r;
  const da = a.components?.days_of_cover ?? Number.POSITIVE_INFINITY, db = b.components?.days_of_cover ?? Number.POSITIVE_INFINITY;
  return da === db ? a.code_1c.localeCompare(b.code_1c) : da - db;
}

function Head() {
  return <thead><tr>
    <th scope="col">Товар</th>
    <th scope="col" className={`${s.thNum} ${s.wF} ${s.hideTb} ${s.hideSm}`}>Прогноз</th>
    <th scope="col" className={`${s.thNum} ${s.wH} ${s.hideSm}`}>Остаток</th>
    <th scope="col" className={`${s.thNum} ${s.wT} ${s.hideTb} ${s.hideSm}`}>В пути</th>
    <th scope="col" className={`${s.thNum} ${s.wS} ${s.hideMd} ${s.hideSm}`}>Запас</th>
    <th scope="col" className={`${s.thNum} ${s.wM} ${s.hideMd} ${s.hideSm}`}>Кратн.</th>
    <th scope="col" className={`${s.thNum} ${s.wQ}`}>Рекомендуем</th>
    <th scope="col" className={s.wU}>Срочность</th>
    <th scope="col" className={`${s.thNum} ${s.wC} ${s.hideSm}`}>Сумма</th>
    <th scope="col" className={s.wX}><span className={srOnly}>Расчёт</span></th>
  </tr></thead>;
}

function SkeletonBody() {
  return <tbody aria-hidden>
    <tr className={s.groupRow}><td colSpan={COLS}><div className={s.groupHead}><Skel w={36} h={36} r={8} /><Skel w={200} h={16} /></div></td></tr>
    {Array.from({ length: 8 }, (_, i) => <tr key={i} className={s.row}>
      <td><Skel w="72%" h={13} /><span className={s.gap} /><Skel w="38%" h={10} /></td>
      <td className={`${s.hideTb} ${s.hideSm}`}><Skel w={48} h={12} /></td>
      <td className={s.hideSm}><Skel w={40} h={12} /></td>
      <td className={`${s.hideTb} ${s.hideSm}`}><Skel w={32} h={12} /></td>
      <td className={`${s.hideMd} ${s.hideSm}`}><Skel w={36} h={12} /></td>
      <td className={`${s.hideMd} ${s.hideSm}`}><Skel w={20} h={12} /></td>
      <td><Skel w={52} h={14} /></td>
      <td><Skel w={88} h={22} r={6} /></td>
      <td className={s.hideSm}><Skel w={80} h={12} /></td>
      <td />
    </tr>)}
  </tbody>;
}

type RowProps = { row: RecRow; supplier: string; cost?: CostInfo; costState: CostState; open: boolean; tabbable: boolean;
  onKey: (e: KeyboardEvent<HTMLTableRowElement>, id: string) => void; onToggle: (id: string) => void; onFocusRow: (id: string) => void; register: (id: string, el: HTMLTableRowElement | null) => void };

const Row = memo(function Row({ row, supplier, cost, costState, open, tabbable, onKey, onToggle, onFocusRow, register }: RowProps) {
  const c = row.components ?? {};
  const final = row.qty_adjusted ?? row.qty_recommended;
  const adjusted = row.qty_adjusted !== null && row.qty_adjusted !== row.qty_recommended;
  const onHand = toNum(row.on_hand) ?? 0;
  const cover = c.days_of_cover;
  const oneOffs = (c.outliers_excluded ?? row.outliers_excluded ?? []).length;
  const stockouts = (c.stockout_months ?? row.stockout_months ?? []).length;
  let costCell;
  if (supplier !== "SE") costCell = <span className={s.unknownCost} title="себестоимость не задана">не задана<span className={srOnly}> — себестоимость не задана</span></span>;
  else if (costState === "loading") costCell = <Skel w={80} h={12} />;
  else if (costState === "unavailable") costCell = <span className={s.unknownCost}>цена недоступна</span>;
  else { const m = lineCost(final, cost?.unit_cost); costCell = m ? money(m) : <span className={s.unknownCost}>цена не задана</span>; }
  return <tr ref={el => register(row.id, el)} tabIndex={tabbable ? 0 : -1} aria-expanded={open} aria-controls={open ? `ob-rat-${row.id}` : undefined}
    className={`${s.row} ${s[`u_${row.urgency}`] ?? ""} ${open ? s.rowOpen : ""}`} onClick={() => onToggle(row.id)} onKeyDown={e => onKey(e, row.id)} onFocus={() => onFocusRow(row.id)}>
    <td className={s.cName}>
      <span className={s.name} title={row.name}>{row.name}</span>
      <span className={s.meta}>{row.code_1c}{cost?.article ? ` · ${cost.article}` : ""}{oneOffs ? ` · исключено ${oneOffs} док.` : ""}{stockouts ? ` · дефицит ${stockouts} мес` : ""}</span>
    </td>
    <td className={`${s.num} ${s.hideTb} ${s.hideSm}`}>{qty(row.forecast_qty)}</td>
    <td className={`${s.num} ${s.hideSm} ${onHand < 0 ? s.neg : ""}`}>{qty(row.on_hand)}</td>
    <td className={`${s.num} ${s.hideTb} ${s.hideSm}`}>{toNum(row.in_transit) ? qty(row.in_transit) : <span className={s.muted}>0</span>}</td>
    <td className={`${s.num} ${s.hideMd} ${s.hideSm}`}>{qty(c.safety)}</td>
    <td className={`${s.num} ${s.hideMd} ${s.hideSm}`}>{int(row.moq)}</td>
    <td className={`${s.num} ${s.cQty}`}><strong>{int(final)}</strong>{adjusted && <span className={s.was}>было {int(row.qty_recommended)}</span>}</td>
    <td className={s.cUrg}><UrgencyPill urgency={row.urgency} /><span className={`${s.cover} ${cover !== undefined && cover < 0 ? s.neg : ""}`}>{cover === undefined ? " " : cover < 0 ? "дефицит" : `запас ${int(cover)} дн`}</span></td>
    <td className={`${s.num} ${s.cCost} ${s.hideSm}`}>{costCell}</td>
    <td className={s.cChev} aria-hidden>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
  </tr>;
});

type AdjustState = { kind: "idle" | "busy" | "ok" | "unavailable" | "stale" | "error"; text?: string };
function AdjustForm({ row, onClose, onSaved }: { row: RecRow; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState(String(row.qty_adjusted ?? row.qty_recommended));
  const [reason, setReason] = useState("");
  const [state, setState] = useState<AdjustState>({ kind: "idle" });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(value);
    if (value.trim() === "" || !Number.isInteger(n) || n < 0) { setState({ kind: "error", text: "Количество — целое число от 0" }); return; }
    if (!reason.trim()) { setState({ kind: "error", text: "Укажите причину правки" }); return; }
    setState({ kind: "busy" });
    try {
      await apiRequest(`/api/recommendations/${encodeURIComponent(row.id)}/adjust`, { method: "POST", body: JSON.stringify({ qty: n, reason: reason.trim(), version: row.version ?? 1 }) });
      setState({ kind: "ok", text: `Сохранено: ${int(n)} шт. Рекомендация агента осталась в истории.` });
      onSaved();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404 && error.code !== "not_found") setState({ kind: "unavailable" });
      else if (error instanceof ApiError && (error.status === 409 || error.status === 404)) setState({ kind: "stale" });
      else setState({ kind: "error", text: error instanceof Error ? error.message : "Не удалось сохранить" });
    }
  };
  return <form className={s.form} onSubmit={submit} aria-label={`Правка количества ${row.code_1c}`}>
    <label className={s.field}>Количество, шт<input className={s.qtyInput} inputMode="numeric" value={value} onChange={e => setValue(e.target.value)} aria-describedby={`ob-adj-${row.id}`} /></label>
    <label className={`${s.field} ${s.reasonField}`}>Причина<input className={s.reasonInput} value={reason} required placeholder="Например: акция у клиента" onChange={e => setReason(e.target.value)} /></label>
    <Btn type="submit" variant="dark" disabled={state.kind === "busy"} aria-busy={state.kind === "busy"}>{state.kind === "busy" ? "Сохраняю…" : "Сохранить"}</Btn>
    <Btn variant="ghost" onClick={onClose}>Отмена</Btn>
    <div className={s.formStatus} id={`ob-adj-${row.id}`}>
      {state.kind === "unavailable" && <StateBlock kind="unavailable" title="Правка на сервере пока недоступна — количество не изменено" detail="Рекомендация агента остаётся в силе." />}
      {state.kind === "stale" && <StateBlock kind="stale" title="Данные обновились — обновите" detail="Версия рекомендации изменилась, правка не применена." onAction={onSaved} actionLabel="Обновить" />}
      {(state.kind === "ok" || state.kind === "error") && <Receipt tone={state.kind === "ok" ? "ok" : "bad"}>{state.text}</Receipt>}
    </div>
  </form>;
}

function RationaleRow({ row, axes, onClose, onSaved }: { row: RecRow; axes?: Axes; onClose: () => void; onSaved: () => void }) {
  const c = row.components ?? {};
  const final = row.qty_adjusted ?? row.qty_recommended;
  return <tr id={`ob-rat-${row.id}`} className={`${s.ratRow} ${s[`u_${row.urgency}`] ?? ""}`} onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } }}>
    <td colSpan={COLS}>
      <div className={s.rat}>
        <div className={s.ratHead}>
          <h3>Как получено {int(final)} шт</h3>
          <Truth axes={axes} />
        </div>
        <Tape c={c} recommended={row.qty_recommended} />
        <div className={s.panels}>
          <SeasonPanel c={c} />
          <OneOffPanel list={c.outliers_excluded ?? row.outliers_excluded ?? []} threshold={c.outlier_threshold} />
          <StockoutPanel months={c.stockout_months ?? row.stockout_months ?? []} uplift={c.stockout_uplift} />
        </div>
        <div className={s.ratSources}><SourcesLine c={c} /><Link href={`/opus_b/skus/${encodeURIComponent(row.code_1c)}`} className={btnClass("outline", "small")}>Карточка товара <ArrowUpRight size={14} aria-hidden /></Link></div>
        <AdjustForm row={row} onClose={onClose} onSaved={onSaved} />
      </div>
    </td>
  </tr>;
}

function GroupHead({ group, shownRows }: { group: RecGroup; shownRows: number }) {
  const total = group.rows.length;
  return <tr className={s.groupRow}><td colSpan={COLS}><div className={s.groupHead}>
    <Mark id={group.supplier_id} square />
    <div className={s.groupName}><strong>{SUPPLIER[group.supplier_id] ?? group.supplier_id}</strong><span>{shownRows === total ? `${int(total)} ${plural(total, "позиция", "позиции", "позиций")}` : `показано ${int(shownRows)} из ${int(total)}`} · расчёт агента</span></div>
    <div className={s.groupStats}>
      <span className={s.stat}><span>Штук к заказу</span><b>{int(group.total_qty)}</b></span>
      <span className={s.stat}><span>Сумма</span>{group.total_cost ? <b>{money(group.total_cost)}</b> : <b className={s.unknown}>себестоимость не задана</b>}</span>
      <span className={`${s.stat} ${s.hideSm}`}><span>Цена известна</span><b>{int(group.cost_known_lines)} из {int(total)}</b></span>
    </div>
  </div></td></tr>;
}

export function Replenishment() {
  const recs = useApi<RecResponse>("/api/recommendations");
  const se0 = useApi<SkuList>("/api/skus?supplier=SE&limit=500&offset=0");
  const se1 = useApi<SkuList>("/api/skus?supplier=SE&limit=500&offset=500");
  const [tab, setTab] = useState<string>("all");
  const [urgencies, setUrgencies] = useState<Set<Urgency>>(() => new Set());
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [calc, setCalc] = useState<{ busy: boolean; tone?: "ok" | "bad"; text?: string }>({ busy: false });
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const orderRef = useRef<string[]>([]);
  const openRef = useRef(open);
  const focusTarget = useRef<string | null>(null);
  const handledQuery = useRef(false);

  const costs = useMemo(() => {
    const map = new Map<string, CostInfo>();
    for (const item of [...(se0.data?.items ?? []), ...(se1.data?.items ?? [])]) map.set(item.code_1c, { unit_cost: item.unit_cost, article: item.article });
    return map;
  }, [se0.data, se1.data]);
  const costState: CostState = se0.data && se1.data ? "ready" : (se0.error && !se0.data) || (se1.error && !se1.data) ? "unavailable" : "loading";

  const groups = useMemo(() => (recs.data?.groups ?? []).map(g => ({ ...g, rows: [...g.rows].sort(byUrgency) })), [recs.data]);
  const tabs = useMemo(() => [{ key: "all", label: "Все", count: groups.reduce((n, g) => n + g.rows.length, 0) }, ...groups.map(g => ({ key: g.supplier_id, label: g.supplier_id, count: g.rows.length }))], [groups]);
  const tabGroups = useMemo(() => (tab === "all" ? groups : groups.filter(g => g.supplier_id === tab)), [groups, tab]);
  const counts = useMemo(() => { const out: Record<string, number> = { critical: 0, soon: 0, normal: 0, none: 0 }; for (const g of tabGroups) for (const r of g.rows) out[r.urgency] = (out[r.urgency] ?? 0) + 1; return out; }, [tabGroups]);
  const visible = useMemo(() => tabGroups.map(group => {
    const rows = urgencies.size ? group.rows.filter(r => urgencies.has(r.urgency)) : group.rows;
    return { group, rows, shown: rows.slice(0, limits[group.supplier_id] ?? PAGE) };
  }), [tabGroups, urgencies, limits]);
  const order = useMemo(() => visible.flatMap(v => v.shown.map(r => r.id)), [visible]);
  const current = activeId && order.includes(activeId) ? activeId : order[0] ?? null;
  useLayoutEffect(() => { orderRef.current = order; openRef.current = open; });

  const focusRow = useCallback((id: string) => { setActiveId(id); rowRefs.current.get(id)?.focus(); }, []);
  const toggle = useCallback((id: string) => { setActiveId(id); setOpen(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }, []);
  const collapse = useCallback((id: string) => {
    setOpen(prev => { if (!prev.has(id)) return prev; const next = new Set(prev); next.delete(id); return next; });
    setActiveId(id); requestAnimationFrame(() => rowRefs.current.get(id)?.focus());
  }, []);
  const register = useCallback((id: string, el: HTMLTableRowElement | null) => { if (el) rowRefs.current.set(id, el); else rowRefs.current.delete(id); }, []);
  const onFocusRow = useCallback((id: string) => setActiveId(id), []);
  const onKey = useCallback((e: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    const list = orderRef.current; const idx = list.indexOf(id);
    const go = (i: number) => { const next = list[Math.max(0, Math.min(list.length - 1, i))]; e.preventDefault(); if (next) focusRow(next); };
    switch (e.key) {
      case "ArrowDown": case "j": go(idx + 1); break;
      case "ArrowUp": case "k": go(idx - 1); break;
      case "Home": go(0); break;
      case "End": go(list.length - 1); break;
      case "Enter": case " ": e.preventDefault(); toggle(id); break;
      case "Escape": if (openRef.current.has(id)) { e.preventDefault(); collapse(id); } break;
    }
  }, [focusRow, toggle, collapse]);

  // Deep link: /opus_b/replenishment?focus=<code_1c>&supplier=SE opens and focuses that row.
  useEffect(() => {
    if (handledQuery.current || !groups.length) return;
    handledQuery.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("focus"), sup = params.get("supplier");
    if (sup && groups.some(g => g.supplier_id === sup)) setTab(sup);
    if (!code) return;
    for (const g of groups) {
      const i = g.rows.findIndex(r => r.code_1c === code);
      if (i < 0) continue;
      const id = g.rows[i].id;
      setTab(g.supplier_id); setUrgencies(new Set());
      setLimits(l => ({ ...l, [g.supplier_id]: Math.max(PAGE, Math.ceil((i + 1) / PAGE) * PAGE) }));
      setOpen(new Set([id])); setActiveId(id); focusTarget.current = id;
      break;
    }
  }, [groups]);
  useEffect(() => {
    const id = focusTarget.current; if (!id) return;
    const el = rowRefs.current.get(id);
    if (el) { focusTarget.current = null; el.focus({ preventScroll: true }); el.scrollIntoView({ block: "center" }); }
  });

  const selectTab = (key: string) => { setTab(key); };
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = tabs.findIndex(t => t.key === tab);
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    setTab(next.key); document.getElementById(`ob-tab-${next.key}`)?.focus();
  };
  const toggleUrgency = (u: Urgency) => setUrgencies(prev => { const next = new Set(prev); if (next.has(u)) next.delete(u); else next.add(u); return next; });
  const recalc = async () => {
    setCalc({ busy: true });
    try {
      const res = await apiRequest<{ skus: number; recommended: number }>("/api/calc/run", { method: "POST", body: JSON.stringify({ scope: tab === "all" ? {} : { supplier: tab } }) });
      setCalc({ busy: false, tone: "ok", text: `Расчёт готов: прочитано ${int(res.skus)} артикулов, к заказу ${int(res.recommended)}.` });
      recs.reload();
    } catch (error) { setCalc({ busy: false, tone: "bad", text: error instanceof Error ? error.message : "Расчёт не выполнен" }); }
  };

  const totalRows = groups.reduce((n, g) => n + g.rows.length, 0);
  const totalQty = groups.reduce((n, g) => n + g.total_qty, 0);
  const loading = !recs.data && !recs.error;
  const shownCount = visible.reduce((n, v) => n + v.rows.length, 0);

  return <div className={s.page}>
    <header className={s.head}>
      <div>
        <p className={s.crumb}>Закупки</p>
        <h1 className={s.h1}>Пополнение</h1>
        <p className={s.sub}>{recs.data ? `${int(totalRows)} ${plural(totalRows, "позиция", "позиции", "позиций")} к заказу · ${int(totalQty)} шт · ${groups.length} ${plural(groups.length, "поставщик", "поставщика", "поставщиков")} · сначала срочные` : loading ? <Skel w={360} h={14} /> : " "}</p>
      </div>
      <div className={s.actions}>
        <Btn variant="outline" onClick={recalc} disabled={calc.busy} aria-busy={calc.busy}><RefreshCw size={15} aria-hidden />{calc.busy ? "Считаю…" : "Пересчитать"}</Btn>
        <Link href="/opus_b/today" className={btnClass("primary")}>К решениям</Link>
      </div>
    </header>
    <div className={s.receiptWrap}><Receipt tone={calc.tone}>{calc.text}</Receipt></div>

    <div className={s.tabs} role="tablist" aria-label="Поставщики">
      {(recs.data ? tabs : [{ key: "all", label: "Все", count: 0 }]).map(t => <button key={t.key} id={`ob-tab-${t.key}`} type="button" role="tab" aria-selected={tab === t.key} tabIndex={tab === t.key ? 0 : -1}
        className={s.tab} onClick={() => selectTab(t.key)} onKeyDown={onTabKey}>{t.label}<span className={s.count}>{recs.data ? int(t.count) : "…"}</span></button>)}
    </div>
    <div className={s.toolbar}>
      <div className={s.filters} role="group" aria-label="Срочность">
        {FILTERS.map(u => <button key={u} type="button" aria-pressed={urgencies.has(u)} className={s.filter} onClick={() => toggleUrgency(u)}>
          <span className={`${s.dot} ${s[`dot_${u}`]}`} aria-hidden />{cap(LABELS.urgency[u])}<span className={s.count}>{recs.data ? int(counts[u] ?? 0) : "…"}</span></button>)}
      </div>
      <div className={s.toolRight}>
        <p className={s.hint} aria-hidden><Kbd>↑</Kbd><Kbd>↓</Kbd> строки · <Kbd>Enter</Kbd> расчёт · <Kbd>Esc</Kbd> свернуть</p>
        <Truth axes={recs.data} />
      </div>
    </div>

    {recs.error && recs.data && <div className={s.banner}><StateBlock kind="unavailable" title="Не удалось обновить — показываю последнее" detail={recs.error.message} onAction={recs.reload} /></div>}
    {recs.error && !recs.data ? <StateBlock kind="unavailable" title="Рекомендации недоступны" detail={recs.error.message} onAction={recs.reload} />
      : recs.data && totalRows === 0 ? <StateBlock kind="empty" title="Заказывать нечего — рекомендаций нет" detail="Запустите расчёт, чтобы агенты пересчитали потребность." onAction={recalc} actionLabel="Пересчитать" />
      : recs.data && shownCount === 0 ? <StateBlock kind="empty" title="По этому фильтру позиций нет" detail="Снимите фильтр срочности или выберите другого поставщика." onAction={() => setUrgencies(new Set())} actionLabel="Сбросить фильтр" />
      : <div role="tabpanel" aria-labelledby={`ob-tab-${tab}`} aria-busy={loading}>
        {loading && <span className={srOnly} role="status">Загружаю рекомендации…</span>}
        <table className={s.table} aria-label="Рекомендации к заказу по поставщикам">
          <Head />
          {loading ? <SkeletonBody /> : visible.filter(v => v.rows.length).map(({ group, rows, shown }) => <tbody key={group.supplier_id}>
            <GroupHead group={group} shownRows={rows.length} />
            {shown.map(row => <Fragment key={row.id}>
              <Row row={row} supplier={group.supplier_id} cost={costs.get(row.code_1c)} costState={costState} open={open.has(row.id)} tabbable={row.id === current}
                onKey={onKey} onToggle={toggle} onFocusRow={onFocusRow} register={register} />
              {open.has(row.id) && <RationaleRow row={row} axes={recs.data} onClose={() => collapse(row.id)} onSaved={recs.reload} />}
            </Fragment>)}
            {rows.length > shown.length && <tr className={s.more}><td colSpan={COLS}>
              <Btn variant="ghost" onClick={() => setLimits(l => ({ ...l, [group.supplier_id]: (l[group.supplier_id] ?? PAGE) + PAGE }))}>Показать ещё {int(Math.min(PAGE, rows.length - shown.length))} · показано {int(shown.length)} из {int(rows.length)}</Btn>
            </td></tr>}
          </tbody>)}
        </table>
      </div>}
  </div>;
}
