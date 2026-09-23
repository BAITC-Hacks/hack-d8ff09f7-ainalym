// Display-only formatting. Money stays a decimal string; arithmetic goes through integer minor units (bigint).
export type Money = { amount: string; currency: string };
export const B0 = BigInt(0);
const B50 = BigInt(50), B100 = BigInt(100);
const NBSP = " ";
const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
export function toMinor(amount: string): bigint {
  const neg = amount.trim().startsWith("-");
  const [int = "0", frac = ""] = amount.trim().replace(/^[-+]/, "").split(".");
  const value = BigInt(int || "0") * B100 + BigInt((frac + "00").slice(0, 2));
  return neg ? -value : value;
}
export function formatMinor(minor: bigint, currency = "KZT", withCents = false): string {
  const neg = minor < B0; const abs = neg ? -minor : minor;
  const whole = withCents ? abs / B100 : (abs + B50) / B100;
  const cents = (abs % B100).toString().padStart(2, "0");
  const sign = currency === "KZT" ? "₸" : currency;
  return `${neg ? "−" : ""}${group(whole.toString())}${withCents ? `,${cents}` : ""}${NBSP}${sign}`;
}
export const money = (m: Money | null | undefined, withCents = false) => (m ? formatMinor(toMinor(m.amount), m.currency, withCents) : "—");
export const lineCost = (unitCost: string, qty: number) => toMinor(unitCost) * BigInt(Math.trunc(qty));
export function qty(value: number | string | null | undefined, digits = 0): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  const s = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n);
  return s.replace(/\s/g, NBSP).replace("-", "−");
}
export const pct = (share: number) => `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: share < 0.1 || (share > 0.99 && share < 1) ? 1 : 0 }).format(Math.min(share, share < 1 ? 0.999 : 1) * 100)}${NBSP}%`;
const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
export const monthShort = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym;
export const monthLong = (ym: string) => `${monthShort(ym)} ${ym.slice(0, 4)}`;
export function day(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).replace(" г.", "");
}
export function clock(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
export const plural = (n: number, one: string, few: string, many: string) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many;
};
