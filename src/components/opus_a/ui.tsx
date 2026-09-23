"use client";
import type { ReactNode } from "react";
import { AlertTriangle, CircleCheck, CircleDashed, Clock3, OctagonAlert, RefreshCw, Inbox } from "lucide-react";
import { TruthAxisLabels, LABELS, type TruthAxes } from "@/components/labels";

export type Urgency = "critical" | "soon" | "normal" | "none";
export const URGENCY_ORDER: Record<string, number> = { critical: 0, soon: 1, normal: 2, none: 3 };

export function Pill({ tone, icon, children, title }: { tone?: "ok" | "warn" | "bad" | "plum"; icon?: ReactNode; children: ReactNode; title?: string }) {
  return <span className="oa-pill" data-tone={tone} title={title}>{icon}{children}</span>;
}
/** Urgency labels come from the single label table (CONTRACTS §5). */
export function UrgencyPill({ urgency }: { urgency: string }) {
  const label = LABELS.urgency[urgency as Urgency] ?? "срочность не указана";
  if (urgency === "critical") return <Pill tone="bad" icon={<OctagonAlert aria-hidden />}>{label}</Pill>;
  if (urgency === "soon") return <Pill tone="warn" icon={<Clock3 aria-hidden />}>{label}</Pill>;
  if (urgency === "normal") return <Pill tone="ok" icon={<CircleCheck aria-hidden />}>{label}</Pill>;
  return <Pill icon={<CircleDashed aria-hidden />}>{label}</Pill>;
}
export function Truth({ axes }: { axes?: TruthAxes | null }) {
  if (!axes) return null;
  return <div className="oa-truth"><TruthAxisLabels axes={{ provenance: axes.provenance, ai: axes.ai, external: axes.external }} /></div>;
}
export function Skel({ w = "100%", h = 16, style }: { w?: number | string; h?: number; style?: React.CSSProperties }) {
  return <span className="oa-skel" aria-hidden style={{ width: w, height: h, ...style }} />;
}
/** Honest states: each kind has its own look so loading/empty/unavailable/stale never read the same. */
export function State({ kind, title, children, onRetry, retryLabel }: { kind: "empty" | "unavailable" | "stale" | "ok" | "info"; title: string; children?: ReactNode; onRetry?: () => void; retryLabel?: string }) {
  const icon = kind === "unavailable" ? <AlertTriangle size={18} aria-hidden /> : kind === "stale" ? <RefreshCw size={18} aria-hidden /> : kind === "ok" ? <CircleCheck size={18} aria-hidden /> : <Inbox size={18} aria-hidden />;
  return <div className="oa-state" data-kind={kind} role={kind === "unavailable" || kind === "stale" ? "alert" : "status"}>
    {icon}<div><strong>{title}</strong>{children ? <div>{children}</div> : null}</div>
    {onRetry ? <button type="button" className="oa-btn oa-btn-outline oa-btn-sm" onClick={onRetry}>{retryLabel ?? "Повторить"}</button> : null}
  </div>;
}
export const STALE_TITLE = "Данные обновились";
export type ApiErr = { status: number; code: string; message: string } | null;
export function ErrorState({ error, onRetry }: { error: ApiErr; onRetry?: () => void }) {
  if (!error) return null;
  if (error.status === 409) return <State kind="stale" title={STALE_TITLE} onRetry={onRetry} retryLabel="Обновить">Кто-то изменил запись после того, как вы её открыли.</State>;
  return <State kind="unavailable" title={error.status === 0 ? "Нет связи — показываю последнее" : "Данные недоступны"} onRetry={onRetry}>{error.message}</State>;
}

/** Real partner image only; null and failed assets leave no decorative placeholder. */
export function ProductImage({ src }: { src?: string | null }) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="oa-product-image" src={src} alt="" width={28} height={28} loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />;
}
