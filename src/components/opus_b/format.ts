const nf = (digits: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
const nf0 = nf(0), nf1 = nf(1);
export const toNum = (v: string | number | null | undefined) => { if (v === null || v === undefined || v === "") return null; const n = typeof v === "number" ? v : Number(v); return Number.isFinite(n) ? n : null; };
/** Quantity: integers stay integers, fractions keep one digit. */
export function qty(v: string | number | null | undefined, empty = "—") { const n = toNum(v); if (n === null) return empty; return Number.isInteger(n) ? nf0.format(n) : nf1.format(n); }
export const int = (v: string | number | null | undefined) => { const n = toNum(v); return n === null ? "—" : nf0.format(Math.round(n)); };
export type Money = { amount: string; currency: string };
const sym = (c: string) => (c === "KZT" ? "₸" : c);
/** Money display only; the decimal string is the truth, display rounds to whole tenge. */
export function money(m: Money | null | undefined, empty = "—") { if (!m) return empty; const n = toNum(m.amount); return n === null ? empty : `${nf0.format(Math.round(n))} ${sym(m.currency)}`; }
export function moneyShort(m: Money | null | undefined, empty = "—") {
  if (!m) return empty; const n = toNum(m.amount); if (n === null) return empty; const a = Math.abs(n);
  if (a >= 1e9) return `${nf1.format(n / 1e9)} млрд ${sym(m.currency)}`;
  if (a >= 1e6) return `${nf1.format(n / 1e6)} млн ${sym(m.currency)}`;
  if (a >= 1e4) return `${nf0.format(n / 1e3)} тыс. ${sym(m.currency)}`;
  return `${nf0.format(n)} ${sym(m.currency)}`;
}
/** qty × unit cost in integer minor units (display only; never stored). */
export function lineCost(q: number, unitCost: string | null | undefined, currency = "KZT"): Money | null {
  if (unitCost === null || unitCost === undefined) return null; const minor = Math.round(Number(unitCost) * 100); if (!Number.isFinite(minor)) return null;
  return { amount: ((minor * q) / 100).toFixed(2), currency };
}
const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
export const MONTH_LETTERS = ["Я", "Ф", "М", "А", "М", "И", "И", "А", "С", "О", "Н", "Д"];
export function ym(value: string) { const [y, m] = value.split("-"); const i = Number(m) - 1; return `${MONTHS[i] ?? m} ${y?.slice(2)}`; }
export function ymLong(value: string) { const [y, m] = value.split("-"); const i = Number(m) - 1; return `${MONTHS[i] ?? m} ${y}`; }
export function day(value?: string | null) { if (!value) return "—"; const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value); return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }); }
export function dayShort(value?: string | null) { if (!value) return "—"; const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value); return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }).replace(".", ""); }
export function ago(value?: string | null) {
  if (!value) return ""; const t = new Date(value).getTime(); if (Number.isNaN(t)) return ""; const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return "только что"; const m = Math.round(s / 60); if (m < 60) return `${m} мин назад`; const h = Math.round(m / 60); if (h < 24) return `${h} ч назад`; return day(value);
}
export function plural(n: number, one: string, few: string, many: string) { const a = Math.abs(n) % 100, b = a % 10; if (a > 10 && a < 20) return many; if (b > 1 && b < 5) return few; if (b === 1) return one; return many; }
