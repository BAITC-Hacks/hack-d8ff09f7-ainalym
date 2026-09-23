"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, ChevronDown, ChevronUp } from "lucide-react";
import { UrgencyChip } from "@/components/labels";
import { localHref } from "./types";
import styles from "./assistant.module.css";

/** Additive client-side render hint on voice tool results (VOICE-FIX-2). Every field is optional — unknown shapes fall back to the plain card. */
export type RenderSpec = {
  kind?: "urgent_list" | "sku_explain" | "queue" | "calc_result" | "cashflow" | string;
  summary_ru?: string; summary?: string; total?: number; count?: number;
  items?: RenderItem[]; top?: RenderItem[];
  next_step?: RenderAction; action?: RenderAction; actions?: RenderAction[];
};
export type RenderItem = { id?: string; code_1c?: string; title?: string; name?: string; qty?: number | string; quantity?: number | string; unit?: string | null; urgency?: string | null; href?: string; meta?: string; amount?: string | number; currency?: string; at?: string };
export type RenderAction = { label?: string; title?: string; href?: string };

const nf = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const KIND_LABEL: Record<string, string> = { urgent_list: "Срочно", sku_explain: "Позиция", queue: "Ждут решения", calc_result: "Расчёт готов", cashflow: "К оплате" };
const plural = (n: number, one: string, few: string, many: string) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many; };

export function isRenderSpec(value: unknown): value is RenderSpec {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const spec = value as RenderSpec;
  return typeof spec.kind === "string" || Array.isArray(spec.items) || Array.isArray(spec.top) || typeof spec.summary_ru === "string";
}

function rebase(href: string, base?: string): string { return base && !href.startsWith(`${base}/`) && href.startsWith("/skus/") ? `${base}${href}` : href; }
function itemHref(item: RenderItem, base?: string): string | undefined {
  const safe = localHref(item.href);
  if (safe) return rebase(safe, base);
  return item.code_1c ? `${base ?? ""}/skus/${encodeURIComponent(item.code_1c)}` : undefined;
}

/** Structured card for tool results: summary line, top items (name · quantity · urgency · link), «Показать все», next step as a button. Never a wall of text. */
export function StructuredCard({ title, render, base, limit = 5 }: { title: string; render: RenderSpec; base?: string; limit?: number }) {
  const [all, setAll] = useState(false);
  const items = (Array.isArray(render.items) ? render.items : Array.isArray(render.top) ? render.top : []).filter(item => item && typeof item === "object");
  const total = typeof render.total === "number" ? render.total : typeof render.count === "number" ? render.count : items.length;
  const kindLabel = KIND_LABEL[String(render.kind)] ?? "Ответ";
  const summary = typeof render.summary_ru === "string" && render.summary_ru.trim() ? render.summary_ru.trim()
    : typeof render.summary === "string" && render.summary.trim() ? render.summary.trim()
    : total > 0 ? `${kindLabel}: ${nf.format(total)} ${plural(total, "позиция", "позиции", "позиций")}` : `${kindLabel}: сейчас ничего нет`;
  const actions = [render.next_step, render.action, ...(Array.isArray(render.actions) ? render.actions : [])].filter((a): a is RenderAction => !!a && typeof a === "object" && typeof (a.label ?? a.title) === "string" && !!localHref(a.href));
  const shown = all ? items : items.slice(0, limit);
  return <article className={styles.result} aria-label={title} data-kind={render.kind}>
    <p className={styles.summaryLine}>{summary}</p>
    {shown.length > 0 && <ul className={styles.structList}>
      {shown.map((item, index) => {
        const name = item.title ?? item.name ?? item.code_1c ?? "Позиция";
        const qty = item.qty ?? item.quantity;
        const href = itemHref(item, base);
        const money = item.amount !== undefined ? `${nf.format(Number(item.amount))} ${item.currency === "KZT" || !item.currency ? "₸" : item.currency}` : undefined;
        return <li key={item.id ?? item.code_1c ?? index}>
          <span className={styles.structName}>{href ? <Link href={href}>{name}<ArrowUpRight size={14} aria-hidden="true" /></Link> : name}</span>
          {qty !== undefined && qty !== null && qty !== "" && <span className={styles.structQty}>{nf.format(Number(qty))} {item.unit ?? "шт"}</span>}
          {money && <span className={styles.structQty}>{money}</span>}
          {item.urgency && <UrgencyChip urgency={item.urgency} />}
          {item.meta && !item.urgency && <span className={styles.meta}>{item.meta}</span>}
        </li>;
      })}
    </ul>}
    {items.length > limit && <button type="button" className={styles.expander} aria-expanded={all} onClick={() => setAll(value => !value)}>
      {all ? <><ChevronUp size={14} aria-hidden="true" />Свернуть</> : <><ChevronDown size={14} aria-hidden="true" />Показать все ({nf.format(items.length)})</>}
    </button>}
    {actions.length > 0 && <div className={styles.actions}>{actions.map((action, index) => <Link key={index} className={styles.actionBtn} href={rebase(localHref(action.href)!, base)}>{action.label ?? action.title}</Link>)}</div>}
  </article>;
}
