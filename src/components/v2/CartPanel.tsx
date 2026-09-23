"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ShoppingCart, X, Trash2, Undo2 } from "lucide-react";
import { Button, UrgencyPill, fmtInt, fmtMoney, stakeTier, type Money, type Urgency } from "./primitives";
import styles from "./CartPanel.module.css";

/** One line of the purchase cart = one line of the supplier's open proposal, with the manager's draft quantity on top. */
export type CartLine = { id: string; code: string; name: string; qty: number; base: number; drafted: boolean; unitCost: number | null; urgency: Urgency; image: string | null };
export type CartSupplier = { id: string; proposalId: string | null; lines: CartLine[]; leadTimeDays: number | null; prepayPct: number };
export type CartSort = "urgency" | "sum";

const PAGE = 60;
const URGENCY_RANK: Record<Urgency, number> = { critical: 0, soon: 1, normal: 2, none: 3 };
const lineSum = (l: CartLine) => l.unitCost == null ? null : l.unitCost * l.qty;
const money = (v: number): Money => ({ amount: v.toFixed(2), currency: "KZT" });
const plural = (n: number, one: string, few: string, many: string) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many; };
export const positions = (n: number) => `${fmtInt(n)} ${plural(n, "позиция", "позиции", "позиций")}`;

/** Totals over every supplier — feeds the header cart button. */
export function cartSummary(suppliers: CartSupplier[]) {
  const lines = suppliers.flatMap(s => s.lines.filter(l => l.qty > 0));
  const costed = lines.filter(l => l.unitCost != null);
  const sum = costed.reduce((a, l) => a + (lineSum(l) ?? 0), 0);
  return { lines: lines.length, sum: costed.length ? money(sum) : null };
}

export function CartButton({ suppliers, onClick }: { suppliers: CartSupplier[]; onClick: () => void }) {
  const s = cartSummary(suppliers);
  return (
    <button type="button" className={styles.cartBtn} onClick={onClick} data-cart-button aria-haspopup="dialog">
      <ShoppingCart size={15} aria-hidden="true" />
      <span>Корзина</span>
      <span className={styles.cartBtnMeta} data-cart-count>{s.lines ? positions(s.lines) : "пусто"}</span>
      {s.sum && <span className={styles.cartBtnMeta} data-stake={stakeTier(s.sum.amount)}>{fmtMoney(s.sum, true)}</span>}
    </button>
  );
}

export function CartPanel({ open, onClose, suppliers, highlight, onQty }: {
  open: boolean; onClose: () => void; suppliers: CartSupplier[];
  /** The line just added — glows for ~2 s. */
  highlight: { code: string; at: number } | null;
  /** Draft quantity for a line (null = back to the calculated quantity). Same mechanism as «Добавить в корзину». */
  onQty: (supplierId: string, code: string, qty: number | null) => void;
}) {
  const [sort, setSort] = useState<CartSort>("urgency");
  const closeRef = useRef<HTMLButtonElement>(null);
  const summary = cartSummary(suppliers);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    const t = setTimeout(() => closeRef.current?.focus(), 30);
    return () => { window.removeEventListener("keydown", onKey, true); clearTimeout(t); };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !highlight) return;
    const el = document.querySelector<HTMLElement>(`[data-cart-line="${CSS.escape(highlight.code)}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  return (
    <div className={`${styles.root} ${open ? styles.open : ""}`} aria-hidden={!open}>
      <div className={styles.backdrop} onClick={onClose} />
      <aside className={styles.sheet} role="dialog" aria-modal="true" aria-label="Корзина заказа" data-cart-panel>
        <header className={styles.head}>
          <div>
            <h2 className={styles.title}>Корзина заказа</h2>
            <p className={styles.sub} data-cart-total>{summary.lines ? <>{positions(summary.lines)}{summary.sum ? <> · <span data-stake={stakeTier(summary.sum.amount)}>{fmtMoney(summary.sum)}</span></> : " · себестоимость не задана"}</> : "Пока пусто"}</p>
          </div>
          <div className={styles.headTools}>
            <div className={styles.sortGroup} role="group" aria-label="Порядок строк">
              <button type="button" className={`${styles.sortBtn} ${sort === "urgency" ? styles.sortOn : ""}`} aria-pressed={sort === "urgency"} onClick={() => setSort("urgency")}>по срочности</button>
              <button type="button" className={`${styles.sortBtn} ${sort === "sum" ? styles.sortOn : ""}`} aria-pressed={sort === "sum"} onClick={() => setSort("sum")}>по сумме</button>
            </div>
            <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Закрыть корзину"><X size={18} aria-hidden="true" /></button>
          </div>
        </header>

        <div className={styles.body}>
          {summary.lines === 0 && suppliers.every(s => !s.lines.some(l => l.base > 0 && l.qty === 0)) ? (
            <div className={styles.empty}>
              <ShoppingCart size={28} strokeWidth={1.5} aria-hidden="true" />
              <p className={styles.emptyTitle}>В корзине пока ничего нет</p>
              <p className={styles.emptyText}>Раскройте строку в таблице пополнения, укажите количество и нажмите «Добавить в корзину». Сюда попадают все позиции предложения поставщика.</p>
            </div>
          ) : suppliers.map(s => <SupplierBlock key={s.id} supplier={s} sort={sort} highlight={highlight} onQty={onQty} />)}
        </div>

        <footer className={styles.foot}>
          <Button variant="quiet" onClick={onClose}>Продолжить подбор</Button>
        </footer>
      </aside>
    </div>
  );
}

function SupplierBlock({ supplier: s, sort, highlight, onQty }: { supplier: CartSupplier; sort: CartSort; highlight: { code: string; at: number } | null; onQty: (supplierId: string, code: string, qty: number | null) => void }) {
  const active = useMemo(() => s.lines.filter(l => l.qty > 0), [s.lines]);
  const removed = useMemo(() => s.lines.filter(l => l.base > 0 && l.qty === 0), [s.lines]);
  const sorted = useMemo(() => [...active].sort((a, b) => {
    const sa = lineSum(a), sb = lineSum(b);
    if (sort === "sum") { if (sa == null && sb == null) return URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]; if (sa == null) return 1; if (sb == null) return -1; return sb - sa; }
    const u = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]; if (u) return u;
    return (sb ?? -1) - (sa ?? -1);
  }), [active, sort]);
  const [limit, setLimit] = useState(PAGE);
  // The just-added line is always in view even when it sorts beyond the first page.
  const shown = useMemo(() => { const head = sorted.slice(0, limit); if (highlight && !head.some(l => l.code === highlight.code)) { const hit = sorted.find(l => l.code === highlight.code); if (hit) head.push(hit); } return head; }, [sorted, limit, highlight]);
  if (!active.length && !removed.length) return null;

  const units = active.reduce((a, l) => a + l.qty, 0);
  const costed = active.filter(l => l.unitCost != null);
  const sum = costed.reduce((a, l) => a + (lineSum(l) ?? 0), 0);
  const missing = active.length - costed.length;
  const critical = active.filter(l => l.urgency === "critical");
  const criticalSum = critical.reduce((a, l) => a + (lineSum(l) ?? 0), 0);
  const top = costed.length ? costed.reduce((m, l) => (lineSum(l) ?? 0) > (lineSum(m) ?? 0) ? l : m) : null;
  const prepay = sum * s.prepayPct / 100;

  const insights: string[] = [];
  if (critical.length) insights.push(costed.length && sum > 0 ? `${positions(critical.length)} со срочностью «критично» — ${Math.round(criticalSum / sum * 100)} % суммы` : `${positions(critical.length)} со срочностью «критично»`);
  if (top) insights.push(`Самая дорогая позиция: ${top.name.replace(/\s+/g, " ").trim()} — ${fmtMoney(money(lineSum(top) ?? 0))}`);
  if (missing) insights.push(`Без себестоимости: ${positions(missing)} — сумма неполная`);
  else if (!costed.length) insights.push("Себестоимость не задана — сумма не считается");

  return (
    <section className={styles.supplier} aria-label={`Поставщик ${s.id}`} data-cart-supplier={s.id}>
      <div className={styles.supHead}>
        <h3 className={styles.supName}>{s.id}</h3>
        <span className={styles.supMeta}>{positions(active.length)} · {fmtInt(units)} шт</span>
      </div>

      <dl className={styles.totals} data-cart-totals>
        <div><dt>Сумма</dt><dd data-stake={stakeTier(costed.length ? sum : null)}>{costed.length ? fmtMoney(money(sum)) : "—"}{missing > 0 && costed.length > 0 && <small> без {fmtInt(missing)} поз.</small>}</dd></div>
        <div><dt>Предоплата {s.prepayPct} %</dt><dd data-stake={stakeTier(costed.length ? prepay : null)}>{costed.length ? fmtMoney(money(prepay)) : "—"}</dd></div>
        <div><dt>При получении {100 - s.prepayPct} %</dt><dd data-stake={stakeTier(costed.length ? sum - prepay : null)}>{costed.length ? fmtMoney(money(sum - prepay)) : "—"}</dd></div>
        <div><dt>Поставка</dt><dd>{s.leadTimeDays != null ? `~${fmtInt(s.leadTimeDays)} дн` : "—"}</dd></div>
      </dl>

      {insights.length > 0 && <ul className={styles.insights} aria-label="Что важно">{insights.map(t => <li key={t}>{t}</li>)}</ul>}

      <div className={styles.actions}>
        {s.proposalId
          ? <Link href={`/review/${encodeURIComponent(s.proposalId)}`} prefetch={false} className={styles.primary} data-cart-prepare={s.id}>Подготовить заказ поставщику {s.id}</Link>
          : <span className={styles.noProposal}>Для {s.id} нет предложения на проверку</span>}
      </div>

      <ul className={styles.lines}>
        {shown.map(l => <LineRow key={l.id} line={l} flash={highlight?.code === l.code ? highlight.at : null} onQty={q => onQty(s.id, l.code, q)} />)}
      </ul>
      {sorted.length > shown.length && <button type="button" className={styles.more} onClick={() => setLimit(n => n + PAGE)}>Показать ещё {fmtInt(Math.min(PAGE, sorted.length - shown.length))} из {fmtInt(sorted.length - shown.length)}</button>}
      {removed.length > 0 && <p className={styles.removed}>Убрано: {positions(removed.length)} <button type="button" className={styles.linkBtn} onClick={() => removed.forEach(l => onQty(s.id, l.code, null))}><Undo2 size={13} aria-hidden="true" />Вернуть</button></p>}
    </section>
  );
}

function LineRow({ line: l, flash, onQty }: { line: CartLine; flash: number | null; onQty: (q: number | null) => void }) {
  const [val, setVal] = useState(String(l.qty));
  const [seen, setSeen] = useState(l.qty);
  // Outside changes (undo, «Вернуть») reset the field; typed values win until committed.
  if (seen !== l.qty) { setSeen(l.qty); setVal(String(l.qty)); }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commit = (raw: string) => {
    const n = Math.max(0, Math.round(Number(raw)));
    if (!Number.isFinite(n)) return;
    onQty(n === l.base ? null : n);
  };
  const change = (raw: string) => { setVal(raw); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => commit(raw), 450); };
  const sum = lineSum(l);
  return (
    <li key={flash ?? "s"} className={`${styles.line} ${flash ? styles.flash : ""}`} data-cart-line={l.code}>
      <div className={styles.thumb} aria-hidden="true">{l.image ? <img src={l.image} alt="" loading="lazy" /> : <span />}</div>
      <div className={styles.lineMain}>
        <p className={styles.lineName}>{l.name.replace(/\s+/g, " ").trim()}</p>
        <p className={styles.lineMeta}><span>Артикул {l.code}</span><UrgencyPill value={l.urgency} />{l.drafted && <span className={styles.draft}>изменено вами</span>}</p>
      </div>
      <div className={styles.lineSide}>
        <label className={styles.qty}><input type="number" min={0} step={1} inputMode="numeric" value={val} onChange={e => change(e.target.value)} onBlur={e => { if (timer.current) clearTimeout(timer.current); commit(e.target.value); }} aria-label={`Количество, ${l.name}`} /><span>шт</span></label>
        <span className={styles.lineSum} data-stake={stakeTier(sum)}>{sum == null ? <em>цена не задана</em> : fmtMoney(money(sum))}</span>
        <button type="button" className={styles.remove} onClick={() => onQty(0)} aria-label={`Убрать ${l.name}`}><Trash2 size={14} aria-hidden="true" />Убрать</button>
      </div>
    </li>
  );
}
