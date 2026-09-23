"use client";
import { Spinner } from "./loading";
import Link from "next/link";
import { useEffect, type ReactNode, type RefObject } from "react";
import styles from "./ui.module.css";

/* ---------- formatting (money = decimal strings, never floats in display math beyond formatting) ---------- */
const nf0 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtQty = (value: string | number | null | undefined, unit = "шт") => value === null || value === undefined || value === "" ? "—" : `${nf0.format(Number(value))} ${unit}`;
export const fmtNum = (value: string | number | null | undefined, digits = 0) => value === null || value === undefined || value === "" ? "—" : (digits ? new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }) : nf0).format(Number(value));
export const fmtMoney = (amount: string | null | undefined, currency = "KZT") => amount === null || amount === undefined ? "—" : `${nf2.format(Number(amount))} ${currency === "KZT" ? "₸" : currency}`;
export const fmtMoneyShort = (amount: string | null | undefined, currency = "KZT") => {
  if (amount === null || amount === undefined) return "—";
  const n = Number(amount); const sign = currency === "KZT" ? "₸" : ` ${currency}`;
  if (Math.abs(n) >= 1e6) return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(n / 1e6)} млн ${sign}`;
  if (Math.abs(n) >= 1e4) return `${nf0.format(n / 1e3)} тыс ${sign}`;
  return `${nf0.format(n)} ${sign}`;
};
export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
};
export const fmtYm = (ym: string) => { const [y, m] = ym.split("-"); return `${["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"][Number(m) - 1]} ${y.slice(2)}`; };

/* ---------- labels (CONTRACTS §5) ---------- */
export const URGENCY: Record<string, { label: string; tone: Tone }> = {
  critical: { label: "критично", tone: "bad" }, soon: { label: "скоро", tone: "warn" }, normal: { label: "планово", tone: "good" }, none: { label: "не требуется", tone: "neutral" },
};
export const PO_STATE: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "черновик", tone: "neutral" }, approved: { label: "утверждено", tone: "good" }, exported: { label: "передано", tone: "good" }, delivery_failed: { label: "ошибка передачи", tone: "bad" },
};
export type Tone = "good" | "warn" | "bad" | "neutral" | "accent";

/* ---------- atoms ---------- */
export function Pill({ tone = "neutral", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  const icon = tone === "good" ? "✓" : tone === "warn" ? "!" : tone === "bad" ? "×" : "•";
  return <span className={`${styles.pill} ${styles[`pill_${tone}`]}`} title={title}><span className={styles.pillIcon} aria-hidden="true">{icon}</span>{children}</span>;
}
export function Truth({ children }: { children: ReactNode }) { return <span className={styles.truth}>{children}</span>; }
export function Crumbs({ items }: { items: { href?: string; label: string }[] }) {
  return <nav aria-label="Путь" className={styles.crumbs}>{items.map((item, i) => <span key={i}>{item.href ? <Link href={item.href} prefetch={false}>{item.label}</Link> : <span>{item.label}</span>}{i < items.length - 1 && <span aria-hidden="true"> / </span>}</span>)}</nav>;
}
export function PageHead({ crumbs, title, sub, actions, badges }: { crumbs: { href?: string; label: string }[]; title: ReactNode; sub?: ReactNode; actions?: ReactNode; badges?: ReactNode }) {
  return <header className={styles.head}>
    <div className={styles.headText}>
      <Crumbs items={crumbs} />
      <h1 className={styles.display}>{title}</h1>
      {(badges || sub) && <div className={styles.headMeta}>{badges}{sub && <span className={styles.sub}>{sub}</span>}</div>}
    </div>
    {actions && <div className={styles.headActions}>{actions}</div>}
  </header>;
}
export function Kpis({ items }: { items: { label: string; value: ReactNode; meta?: ReactNode; tone?: Tone }[] }) {
  return <dl className={`v2-priority-card ${styles.kpis}`}>{items.map((item, i) => <div key={i} className={styles.kpi}>
    <dt className="v2-metric-label">{item.label}</dt><dd className={`v2-metric-value ${item.tone ? styles[`num_${item.tone}`] : ""}`}>{item.value}</dd>{item.meta && <p className={styles.kpiMeta}>{item.meta}</p>}
  </div>)}</dl>;
}
export function Section({ title, count, aside, children, id }: { title: ReactNode; count?: number; aside?: ReactNode; children: ReactNode; id?: string }) {
  return <section className={styles.section} aria-labelledby={id}>
    <div className={styles.sectionHead}><h2 id={id} className={styles.h2}>{title}{typeof count === "number" && <span className={styles.h2Count}>{count}</span>}</h2>{aside && <div className={styles.sectionAside}>{aside}</div>}</div>
    {children}
  </section>;
}
export function Card({ children, tone, priority = false, className = "" }: { children: ReactNode; tone?: "alert" | "info"; priority?: boolean; className?: string }) {
  return <div className={`${styles.card} ${tone === "alert" ? styles.cardAlert : tone === "info" ? styles.cardInfo : ""} ${priority ? "v2-priority-card" : ""} ${className}`}>{children}</div>;
}
export function Btn({ variant = "secondary", className = "", busy, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "black" | "quiet"; busy?: boolean }) {
  return <button {...props} type={props.type ?? "button"} className={`${styles.btn} ${styles[`btn_${variant}`]} ${className}`} aria-busy={busy || undefined} disabled={props.disabled || busy}>{children}</button>;
}
export function Rows({ children, className = "" }: { children: ReactNode; className?: string }) { return <div className={`${styles.rows} ${className}`}>{children}</div>; }
export function Row({ label, meta, value, valueMeta, href, lead }: { label: ReactNode; meta?: ReactNode; value?: ReactNode; valueMeta?: ReactNode; href?: string; lead?: ReactNode }) {
  const body = <>{lead && <div className={styles.rowLead}>{lead}</div>}<div className={styles.rowText}><span className={styles.rowLabel}>{label}</span>{meta && <span className={styles.rowMeta}>{meta}</span>}</div>{(value !== undefined || valueMeta) && <div className={styles.rowValue}><span>{value}</span>{valueMeta && <span className={styles.rowMeta}>{valueMeta}</span>}</div>}</>;
  return href ? <Link href={href} className={`${styles.row} ${styles.rowLink}`}>{body}</Link> : <div className={styles.row}>{body}</div>;
}

/* ---------- states — visibly distinct: loading / empty / unavailable / stale / offline ---------- */
export function Loading({ label = "Загружаю данные…", lines = 4 }: { label?: string; lines?: number }) {
  return <div className={styles.loading} role="status" aria-live="polite" aria-label={label}>{Array.from({ length: lines }, (_, i) => <span key={i} style={{ width: `${88 - i * 14}%` }} />)}<p style={{ display: "flex", alignItems: "center", gap: 8 }}><Spinner size={14} />{label}</p></div>;
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) { return <div className={styles.empty}><p className={styles.emptyTitle}>{title}</p>{children && <p className={styles.emptyBody}>{children}</p>}</div>; }
export function Unavailable({ title, detail, retry }: { title: string; detail?: ReactNode; retry?: () => void }) {
  return <div className={styles.unavailable} role="alert"><p className={styles.emptyTitle}>{title}</p>{detail && <p className={styles.emptyBody}>{detail}</p>}{retry && <Btn onClick={retry}>Повторить</Btn>}</div>;
}
export function StaleBanner({ children = "Данные обновились — показываю новую версию." }: { children?: ReactNode }) { return <p className={styles.stale} role="status">{children}</p>; }

/* ---------- keyboard: j / k walk rows inside a container, Enter opens a link row ---------- */
export function useRowKeys(container: RefObject<HTMLElement | null>, selector = "[data-row]") {
  useEffect(() => {
    const root = container.current; if (!root) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.key !== "j" && event.key !== "k") return;
      const rows = Array.from(root.querySelectorAll<HTMLElement>(selector));
      if (!rows.length) return;
      const current = rows.findIndex(row => row === document.activeElement || row.contains(document.activeElement));
      const next = event.key === "j" ? Math.min(rows.length - 1, current + 1) : Math.max(0, current - 1);
      rows[next]?.focus(); event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [container, selector]);
}
