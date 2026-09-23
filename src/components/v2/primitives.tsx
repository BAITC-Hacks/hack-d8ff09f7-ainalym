"use client";
import type { ReactNode } from "react";
import { CircleAlert, Clock3, CircleCheck, Circle, RefreshCw } from "lucide-react";
import { ApiError } from "@/components/shell/api";
import styles from "./primitives.module.css";
import { Spinner } from "./loading";

export type Money = { amount: string; currency: string };
export type Urgency = "critical" | "soon" | "normal" | "none";

const CUR: Record<string, string> = { KZT: "₸", USD: "$", EUR: "€", RUB: "₽" };
export const fmtInt = (n: number | string | null | undefined) => (n == null || n === "" || Number.isNaN(Number(n))) ? "—" : Math.round(Number(n)).toLocaleString("ru-RU");
export const fmtNum = (n: number | string | null | undefined, digits = 1) => (n == null || Number.isNaN(Number(n))) ? "—" : Number(n).toLocaleString("ru-RU", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
export function fmtMoney(m: Money | null | undefined, compact = false): string {
  if (!m) return "—";
  const v = Number(m.amount); const sym = CUR[m.currency] ?? m.currency;
  if (compact && Math.abs(v) >= 1e6) return `${(v / 1e6).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн ${sym}`;
  if (compact && Math.abs(v) >= 1e3) return `${(v / 1e3).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} тыс. ${sym}`;
  return `${v.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ${sym}`;
}
export const fmtDate = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "—";
export const fmtYm = (ym: string) => { const [y, m] = ym.split("-"); return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("ru-RU", { month: "short", year: "2-digit" }); };

export const URGENCY_RU: Record<Urgency, string> = { critical: "критично", soon: "скоро", normal: "планово", none: "не требуется" };
export function UrgencyPill({ value }: { value: Urgency }) {
  const Icon = value === "critical" ? CircleAlert : value === "soon" ? Clock3 : value === "normal" ? CircleCheck : Circle;
  return <span className={`${styles.pill} ${styles[`u_${value}`]}`}><Icon size={13} strokeWidth={2} aria-hidden="true" />{URGENCY_RU[value]}</span>;
}
export function Pill({ tone = "neutral", children }: { tone?: "ok" | "warn" | "danger" | "neutral" | "accent"; children: ReactNode }) {
  return <span className={`${styles.pill} ${styles[`t_${tone}`]}`}>{children}</span>;
}

/** Truth labels — canonical RU strings (CONTRACTS §5). */
export function TruthStrip({ ai, external, note }: { ai?: string; external?: string; note?: string }) {
  const aiLabel = ai === "live" ? "Живой AI" : ai === "replay" ? "Воспроизведение · записанное решение" : ai === "unavailable" ? "Провайдер недоступен" : ai === "rules" ? "Правила без LLM" : null;
  return (
    <p className={styles.truth}>
      <span>Данные партнёра · обезличены</span>
      {aiLabel && <span>{aiLabel}</span>}
      {external === "export_only" && <span>Экспорт для 1С (файл)</span>}
      {note && <span>{note}</span>}
    </p>
  );
}

export function Button({ variant = "secondary", busy, className = "", children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet" | "dark"; busy?: boolean }) {
  return <button type="button" {...rest} disabled={rest.disabled || busy} aria-busy={busy || undefined} className={`${styles.btn} ${styles[`b_${variant}`]} ${className}`}>{busy && <RefreshCw size={14} className={styles.spin} aria-hidden="true" />}{children}</button>;
}

export function Skeleton({ rows = 3, height = 16 }: { rows?: number; height?: number }) {
  return <div className={styles.skeleton} aria-busy="true" aria-label="Загружаем">{Array.from({ length: rows }, (_, i) => <span key={i} style={{ height, width: `${100 - (i % 3) * 18}%` }} />)}<div style={{ display: "flex", alignItems: "center", gap: 8, font: "var(--v2-meta)", color: "var(--v2-muted)" }}><Spinner size={14} />Загружаем…</div></div>;
}
export function StateBlock({ kind, title, detail, action }: { kind: "empty" | "unavailable" | "stale" | "offline"; title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className={`${styles.state} ${styles[`s_${kind}`]}`} role={kind === "empty" ? undefined : "status"}>
      <p className={styles.stateTitle}>{title}</p>
      {detail && <p className={styles.stateDetail}>{detail}</p>}
      {action && <div className={styles.stateAction}>{action}</div>}
    </div>
  );
}
export function errorKind(error: ApiError | null): "unavailable" | "stale" | "offline" { return error?.status === 0 ? "offline" : error?.status === 409 ? "stale" : "unavailable"; }
export function errorTitle(error: ApiError | null): string {
  if (!error) return "";
  if (error.status === 0) return "Нет связи — показываю последнее";
  if (error.status === 409) return "Данные обновились";
  if (error.status === 404) return "Маршрут недоступен";
  return "Раздел недоступен";
}

/** Small bar chart for the monthly forecast; accessible via table fallback. */
export function MiniBars({ points, label, tone = "a" }: { points: { k: string; v: number }[]; label: string; tone?: "a" | "b" }) {
  const max = Math.max(1, ...points.map(p => p.v));
  return (
    <figure className={styles.bars} aria-label={label}>
      <div className={styles.barRow} aria-hidden="true">
        {points.map(p => <span key={p.k} className={`${styles.bar} ${styles[`bar_${tone}`]}`} style={{ height: `${Math.max(3, (p.v / max) * 100)}%` }} title={`${p.k}: ${fmtNum(p.v)}`} />)}
      </div>
      <figcaption className={styles.barCaption} aria-hidden="true">{points.map(p => <span key={p.k}>{p.k}</span>)}</figcaption>
      <table className={styles.srOnly}><tbody>{points.map(p => <tr key={p.k}><th scope="row">{p.k}</th><td>{fmtNum(p.v)}</td></tr>)}</tbody></table>
    </figure>
  );
}
/** Area sparkline for a 12-point series (seasonality index). */
export function Sparkline({ values, tone = "a" }: { values: number[]; tone?: "a" | "b" }) {
  const w = 120, h = 32, max = Math.max(...values, 0.01), min = Math.min(...values, 0);
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * w, h - ((v - min) / (max - min || 1)) * (h - 4) - 2] as const);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const stroke = tone === "a" ? "var(--v2-viz-a)" : "var(--v2-viz-b)", fill = tone === "a" ? "var(--v2-viz-a-fill)" : "var(--v2-viz-b-fill)";
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={styles.spark} aria-hidden="true"><path d={`${d} L${w},${h} L0,${h} Z`} fill={fill} /><path d={d} fill="none" stroke={stroke} strokeWidth="1.5" /></svg>;
}
