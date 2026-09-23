import type { TruthAxes } from "@/components/labels";

export type SourceFile = { name: string; supplier_id?: string; as_of?: string; date?: string; anonymised?: boolean; rows?: number };
export type ConnectionsModes = {
  axes?: TruthAxes; mode?: string; state_version?: number;
  labels?: Record<string, string | Record<string, string>>;
  sources?: SourceFile[]; data_sources?: SourceFile[];
  onec?: { label?: string; meta?: string };
};
export function modeLabel(modes: ConnectionsModes | undefined, name: string): string | undefined {
  const label = modes?.labels?.[name];
  return typeof label === "string" ? label : undefined;
}
export function sourceDate(value?: string): string {
  if (!value) return "Дата источника не передана";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date);
}
