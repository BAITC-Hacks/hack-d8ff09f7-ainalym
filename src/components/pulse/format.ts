import Decimal from "decimal.js";
import type { Money } from "./types";
export function formatMoney(money?: Money | null): string {
  if (!money) return "Себестоимость не задана";
  try {
    const amount = new Decimal(money.amount);
    if (!amount.isFinite()) return "Сумма не определена";
    const [whole, fraction] = amount.toFixed(2).split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, "\u2009");
    return `${grouped}${fraction === "00" ? "" : `,${fraction}`}\u2009${money.currency === "KZT" ? "₸" : money.currency}`;
  } catch { return "Сумма не определена"; }
}
export function sumByCurrency(rows: Money[]): Money[] {
  const totals = new Map<string, Decimal>();
  for (const row of rows) {
    try {
      if (!row.currency || !new Decimal(row.amount).isFinite()) continue;
      totals.set(row.currency, (totals.get(row.currency) ?? new Decimal(0)).add(row.amount));
    } catch { continue; }
  }
  return [...totals].map(([currency, amount]) => ({ currency, amount: amount.toFixed(2) }));
}
export function formatTime(value?: string): string {
  if (!value) return "Время не указано";
  const date = new Date(value); return Number.isNaN(date.getTime()) ? "Время не указано" : new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" }).format(date);
}
export function formatDate(value?: string): string {
  if (!value) return "Дата не указана";
  const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "Asia/Almaty" }).format(date);
}
export function safeHref(value: string | undefined, fallback: string): string { return value?.startsWith("/") && !value.startsWith("//") ? value : fallback; }
