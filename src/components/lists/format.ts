import { formatMoney } from "@/components/pulse/format";

export function amountLabel(amount: string | null | undefined, currency?: string) {
  if (amount == null) return "Себестоимость не задана";
  if (!currency) return `${amount} · валюта не указана`;
  return formatMoney({ amount, currency });
}
export function dateLabel(value?: string | null) { if (!value) return "Дата не указана"; const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeZone: "Asia/Almaty" }).format(date); }
