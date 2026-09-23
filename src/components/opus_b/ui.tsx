"use client";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { CircleAlert, CircleCheck, Clock3, CloudOff, Inbox, Minus, RefreshCw, TriangleAlert } from "lucide-react";
import { LABELS, TruthAxisLabels } from "@/components/labels";
import type { Axes, Urgency } from "./types";
import s from "./ui.module.css";

const URGENCY: Record<Urgency, { cls: string; Icon: typeof CircleAlert }> = {
  critical: { cls: s.bad, Icon: CircleAlert },
  soon: { cls: s.warn, Icon: Clock3 },
  normal: { cls: s.ok, Icon: CircleCheck },
  none: { cls: s.neutral, Icon: Minus },
};
export function UrgencyPill({ urgency }: { urgency: Urgency | string }) {
  const known = urgency in URGENCY ? (urgency as Urgency) : "none";
  const { cls, Icon } = URGENCY[known];
  return <span className={`${s.pill} ${cls}`}><Icon size={13} strokeWidth={2.2} aria-hidden />{LABELS.urgency[known] ?? "срочность не указана"}</span>;
}
export function Pill({ tone = "neutral", icon, children, title }: { tone?: "bad" | "warn" | "ok" | "neutral" | "plum"; icon?: ReactNode; children: ReactNode; title?: string }) {
  return <span className={`${s.pill} ${s[tone]}`} title={title}>{icon}{children}</span>;
}
export function Btn({ variant = "outline", size, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "dark" | "outline" | "ghost"; size?: "small" }) {
  return <button type="button" {...rest} className={`${s.btn} ${s[variant]} ${size === "small" ? s.small : ""} ${className ?? ""}`} />;
}
export const btnClass = (variant: "primary" | "dark" | "outline" | "ghost" = "outline", size?: "small") => `${s.btn} ${s[variant]} ${size === "small" ? s.small : ""}`;
export function Mark({ id, square }: { id: string; square?: boolean }) {
  return <span aria-hidden className={`${s.mark} ${id === "SE" ? s.markSE : ""} ${square ? s.markSquare : ""}`}>{id.slice(0, 3)}</span>;
}
export function Kbd({ children }: { children: ReactNode }) { return <kbd className={s.kbd}>{children}</kbd>; }
/** Canonical truth labels (CONTRACTS §5) from the result itself — never inferred. */
export function Truth({ axes }: { axes?: Axes | null }) {
  return <div className={s.truth}><TruthAxisLabels axes={{ provenance: axes?.provenance, ai: axes?.ai, external: axes?.external }} /></div>;
}
export function Skel({ w = "100%", h = 14, r }: { w?: number | string; h?: number; r?: number }) { return <span aria-hidden className={s.skel} style={{ width: w, height: h, borderRadius: r }} />; }
export type StateKind = "empty" | "unavailable" | "stale";
export function StateBlock({ kind, title, detail, onAction, actionLabel }: { kind: StateKind; title: string; detail?: string; onAction?: () => void; actionLabel?: string }) {
  const Icon = kind === "empty" ? Inbox : kind === "stale" ? TriangleAlert : CloudOff;
  const cls = kind === "empty" ? s.stateEmpty : kind === "stale" ? s.stateStale : s.stateUnavailable;
  return <div className={`${s.state} ${cls}`} role={kind === "empty" ? "status" : "alert"}>
    <Icon size={20} aria-hidden />
    <div><strong>{title}</strong>{detail && <p>{detail}</p>}</div>
    {onAction && <Btn size="small" variant={kind === "stale" ? "dark" : "outline"} onClick={onAction}><RefreshCw size={14} aria-hidden />{actionLabel ?? "Повторить"}</Btn>}
  </div>;
}
export function Receipt({ tone, children }: { tone?: "ok" | "bad"; children?: ReactNode }) {
  return <p className={`${s.receipt} ${tone === "ok" ? s.receiptOk : tone === "bad" ? s.receiptBad : ""}`} role="status" aria-live="polite">{children}</p>;
}
export const srOnly = s.srOnly;
