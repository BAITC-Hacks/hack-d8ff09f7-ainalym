import Decimal from "decimal.js";
import type { DatabaseSync } from "node:sqlite";
import { db } from "../db/client";

export interface EngineParams {
  lead_time_days: number;
  review_days: number;
  service_level: number;
  growth_cap: number;
  outlier: { k_month: number; k_doc: number; min_units: number };
}
export interface NeedResult { forecast: Record<string, unknown>; need: number; rationale_ru: string; components: Record<string, unknown>; flags?: string[] }
export interface EngineContext { database?: DatabaseSync; as_of?: string }

type Sku = { code_1c: string; supplier_id: string; name: string; moq: number; median_month_qty: string | null; p95_doc_qty: string | null; on_hand_qty: string | null; on_hand_as_of: string | null };
type Month = { ym: string; qty_file: string | null; qty_regular: string | null; stockout: number };
type Sale = { doc_no: string | null; at: string; qty: string; id: number };
type Outlier = { doc_no: string | null; at: string | null; state: string };

function dec(value: string | number | null | undefined): Decimal { return new Decimal(value ?? 0); }
function monthOf(day: string): string { return day.slice(0, 7); }
function monthNumber(ym: string): number { return parseInt(ym.slice(5, 7), 10); }
function median(values: Decimal[]): Decimal {
  if (!values.length) return new Decimal(0);
  const sorted = [...values].sort((a, b) => a.comparedTo(b));
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : sorted[middle - 1].plus(sorted[middle]).div(2);
}
function dateUTC(value: string): Date {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (globalThis.Number.isNaN(date.getTime())) throw new RangeError("invalid as_of date");
  return date;
}
function monthsBack(ym: string, count: number): string[] {
  const [year, month] = ym.split("-").map((part) => parseInt(part, 10));
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 2 - index, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

/** Reads every inventory source, then computes one reproducible SKU recommendation. */
export async function computeNeed(code_1c: string, params: EngineParams, ctx: EngineContext = {}): Promise<NeedResult> {
  const database = ctx.database ?? db();
  const asOf = (ctx.as_of ?? new Date().toISOString()).slice(0, 10);
  const sku = database.prepare("SELECT code_1c,supplier_id,name,moq,median_month_qty,p95_doc_qty,on_hand_qty,on_hand_as_of FROM sku WHERE code_1c=?").get(code_1c) as Sku | undefined;
  if (!sku) throw new Error(`SKU ${code_1c} is missing`);
  if (params.lead_time_days < 1 || params.review_days < 0 || params.growth_cap < 0 || params.outlier.min_units < 0 || sku.moq < 1) throw new RangeError("invalid engine parameters");
  const months = database.prepare("SELECT ym,qty_file,qty_regular,stockout FROM sales_month WHERE code_1c=? AND ym<=? ORDER BY ym")
    .all(code_1c, monthOf(asOf)) as Month[];
  const sales = database.prepare("SELECT id,doc_no,at,qty FROM sales_line WHERE code_1c=? AND at<=? ORDER BY at,id")
    .all(code_1c, `${asOf}T23:59:59`) as Sale[];
  if (!months.length && !sales.length && !(database.prepare("SELECT 1 FROM sales_month m JOIN sku s ON s.code_1c=m.code_1c WHERE s.supplier_id=? LIMIT 1").get(sku.supplier_id)))
    throw new Error(`sales source missing for supplier ${sku.supplier_id}`);
  const stockRow = database.prepare("SELECT ym,opening_qty FROM stock_month WHERE code_1c=? AND ym<=? AND known=1 ORDER BY ym DESC LIMIT 1")
    .get(code_1c, monthOf(asOf)) as { ym: string; opening_qty: string | null } | undefined;
  if (!stockRow && !(database.prepare("SELECT 1 FROM stock_month m JOIN sku s ON s.code_1c=m.code_1c WHERE s.supplier_id=? LIMIT 1").get(sku.supplier_id)))
    throw new Error(`stock source missing for supplier ${sku.supplier_id}`);
  const stock = stockRow?.opening_qty !== null && stockRow ? stockRow : { ym: monthOf(asOf), opening_qty: "0" };
  const transitRows = database.prepare("SELECT po_ref,qty,expected_at,source_file FROM in_transit WHERE code_1c=?").all(code_1c) as
    { po_ref: string; qty: string; expected_at: string | null; source_file: string | null }[];
  const transit = transitRows.reduce((sum, row) => sum.plus(row.qty), new Decimal(0));
  const freshOnHand = sku.on_hand_qty !== null && sku.on_hand_as_of !== null && sku.on_hand_as_of <= asOf;
  const onHand = dec(freshOnHand ? sku.on_hand_qty : stock.opening_qty);
  if (months.every((month) => dec(month.qty_file ?? month.qty_regular).isZero()) && sales.every((sale) => dec(sale.qty).isZero())) {
    const flags = ["inactive"];
    return {
      forecast: { horizon_months: (params.lead_time_days + params.review_days) / 30, base_rate: 0, season: {}, growth: 1,
        stockout_uplift: 0, safety: 0, method_ru: "Нет продаж за период" },
      need: 0, rationale_ru: `Код 1С ${code_1c}: нет продаж за период — заказ не требуется`, flags,
      components: { flags, source_months: months.length, sales_lines: sales.length, stock_month: stock.ym,
        on_hand: onHand.toNumber(), on_hand_as_of: freshOnHand ? sku.on_hand_as_of : `${stock.ym}-01`, in_transit: transit.toNumber(), transit_rows: transitRows.length,
        forecast_qty: 0, safety: 0, raw_need: 0, moq: sku.moq, urgency: "none", outliers_excluded: [], stockout_months: [] },
    };
  }

  const existing = database.prepare("SELECT doc_no,at,state FROM outlier_doc WHERE code_1c=?").all(code_1c) as Outlier[];
  const outlierState = new Map(existing.map((row) => [`${row.doc_no}|${row.at?.slice(0, 7)}`, row.state]));
  const docGroups = new Map<string, { doc_no: string; ym: string; qty: Decimal }>();
  for (const sale of sales) {
    const ym = monthOf(sale.at);
    const docNo = sale.doc_no ?? `line:${sale.id}`;
    const key = `${docNo}|${ym}`;
    const group = docGroups.get(key) ?? { doc_no: docNo, ym, qty: new Decimal(0) };
    group.qty = group.qty.plus(sale.qty);
    docGroups.set(key, group);
  }
  const fileMonths = months.map((month) => dec(month.qty_file)).filter((qty) => qty.gt(0));
  const positiveDocs = [...docGroups.values()].map((doc) => doc.qty).filter((qty) => qty.gt(0)).sort((a, b) => a.comparedTo(b));
  const p95Index = Math.max(0, Math.ceil(positiveDocs.length * 0.95) - 1);
  const medianMonth = sku.median_month_qty ? dec(sku.median_month_qty) : median(fileMonths);
  const p95Doc = sku.p95_doc_qty ? dec(sku.p95_doc_qty) : (positiveDocs[p95Index] ?? new Decimal(0));
  const threshold = Decimal.max(params.outlier.min_units, Decimal.min(medianMonth.times(params.outlier.k_month), p95Doc.times(params.outlier.k_doc)));
  const byMonth = new Map<string, Decimal>();
  const seenLineMonths = new Set<string>();
  const excluded: { doc_no: string; ym: string; qty: number; threshold: number }[] = [];
  for (const doc of docGroups.values()) {
    seenLineMonths.add(doc.ym);
    const state = outlierState.get(`${doc.doc_no}|${doc.ym}`);
    if (state === "excluded" || (state !== "kept" && doc.qty.gt(threshold))) {
      excluded.push({ doc_no: doc.doc_no, ym: doc.ym, qty: doc.qty.toNumber(), threshold: threshold.toNumber() });
      continue;
    }
    byMonth.set(doc.ym, (byMonth.get(doc.ym) ?? new Decimal(0)).plus(doc.qty));
  }
  const series = months.map((month) => ({
    ym: month.ym,
    qty: seenLineMonths.has(month.ym) ? (byMonth.get(month.ym) ?? new Decimal(0)) : dec(month.qty_regular ?? month.qty_file),
    stockout: month.stockout === 1,
  }));
  if (!series.length) {
    for (const [ym, qty] of [...byMonth].sort(([a], [b]) => a.localeCompare(b))) series.push({ ym, qty, stockout: false });
  }
  const uncensored = series.filter((point) => !point.stockout);
  if (!uncensored.length) throw new Error(`uncensored sales source missing for ${code_1c}`);
  const baseRate = uncensored.reduce((sum, point) => sum.plus(point.qty), new Decimal(0)).div(uncensored.length);
  const stockoutMonths = series.filter((point) => point.stockout).map((point) => point.ym);
  const stockoutUplift = series.filter((point) => point.stockout)
    .reduce((sum, point) => sum.plus(Decimal.max(0, baseRate.minus(point.qty))), new Decimal(0));

  const supplierSeason = database.prepare("SELECT month,idx FROM season_index WHERE supplier_id=?").all(sku.supplier_id) as { month: number; idx: string }[];
  const ownSeason = uncensored.filter((point) => point.qty.gt(0)).length >= 12;
  const season = new Map<number, Decimal>(supplierSeason.map((row) => [row.month, dec(row.idx)]));
  if (ownSeason && baseRate.gt(0)) {
    for (let month = 1; month <= 12; month++) {
      const peers = uncensored.filter((point) => monthNumber(point.ym) === month);
      if (peers.length) season.set(month, peers.reduce((sum, point) => sum.plus(point.qty), new Decimal(0)).div(peers.length).div(baseRate));
    }
  }

  const recent = monthsBack(monthOf(asOf), 6);
  const seriesMap = new Map(series.map((point) => [point.ym, point]));
  const previous = recent.map((ym) => `${parseInt(ym.slice(0, 4), 10) - 1}${ym.slice(4)}`);
  let growth = new Decimal(1);
  if (recent.every((ym) => seriesMap.has(ym)) && previous.every((ym) => seriesMap.has(ym))) {
    const corrected = (list: string[]) => list.reduce((sum, ym) => {
      const point = seriesMap.get(ym)!;
      return sum.plus(point.stockout ? baseRate : point.qty);
    }, new Decimal(0));
    const earlier = corrected(previous);
    if (earlier.gt(0)) growth = Decimal.min(1 + params.growth_cap, Decimal.max(1 - params.growth_cap, corrected(recent).div(earlier)));
  }

  const horizonDays = params.lead_time_days + params.review_days;
  const cursor = dateUTC(asOf);
  const monthlyForecast = new Map<string, Decimal>();
  let forecastQty = new Decimal(0);
  for (let day = 0; day < horizonDays; day++) {
    const ym = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
    const daily = baseRate.times(growth).times(season.get(cursor.getUTCMonth() + 1) ?? 1).div(30);
    forecastQty = forecastQty.plus(daily);
    monthlyForecast.set(ym, (monthlyForecast.get(ym) ?? new Decimal(0)).plus(daily));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const variance = uncensored.reduce((sum, point) => sum.plus(point.qty.minus(baseRate).pow(2)), new Decimal(0)).div(uncensored.length);
  const sigmaDaily = variance.sqrt().div(new Decimal(30).sqrt());
  const z = params.service_level >= 0.99 ? new Decimal("2.33") : params.service_level >= 0.95 ? new Decimal("1.645") : new Decimal("1.28");
  const safety = z.times(sigmaDaily).times(new Decimal(params.lead_time_days).sqrt());
  const rawNeed = Decimal.max(0, forecastQty.plus(safety).minus(onHand).minus(transit));
  const need = rawNeed.div(sku.moq).ceil().times(sku.moq).toNumber();
  const dailyRate = baseRate.times(growth).div(30);
  const coverDays = dailyRate.gt(0) ? onHand.plus(transit).div(dailyRate) : null;
  const urgency = need === 0 ? "none" : !coverDays || coverDays.lt(params.lead_time_days) ? "critical" : coverDays.lt(horizonDays) ? "soon" : "normal";
  const components = {
    source_months: series.length, sales_lines: sales.length, stock_month: stock.ym, transit_rows: transitRows.length,
    base_rate: baseRate.toDecimalPlaces(3).toNumber(), season_source: ownSeason ? "sku" : "supplier",
    season: Object.fromEntries([...season].map(([month, index]) => [month, index.toDecimalPlaces(3).toNumber()])),
    growth: growth.toDecimalPlaces(3).toNumber(), horizon_days: horizonDays,
    forecast_qty: forecastQty.toDecimalPlaces(3).toNumber(), monthly_forecast: Object.fromEntries([...monthlyForecast].map(([ym, qty]) => [ym, qty.toDecimalPlaces(3).toNumber()])),
    stockout_months: stockoutMonths, stockout_uplift: stockoutUplift.toDecimalPlaces(3).toNumber(),
    outliers_excluded: excluded, outlier_threshold: threshold.toNumber(),
    safety: safety.toDecimalPlaces(3).toNumber(), on_hand: onHand.toNumber(), on_hand_as_of: freshOnHand ? sku.on_hand_as_of : `${stock.ym}-01`, in_transit: transit.toNumber(),
    in_transit_sources: transitRows, raw_need: rawNeed.toDecimalPlaces(3).toNumber(), moq: sku.moq, urgency,
    days_of_cover: coverDays?.toDecimalPlaces(1).toNumber() ?? null,
  };
  const rationale_ru = `Код 1С ${code_1c}: регулярный спрос ${components.base_rate} шт/мес; сезонность ${ownSeason ? "SKU" : "поставщика"}, рост ×${components.growth}; прогноз на ${horizonDays} дн ${components.forecast_qty} + запас ${components.safety} − остаток ${components.on_hand} − в пути ${components.in_transit} = потребность ${need} шт (кратность ${sku.moq}). Без продаж из-за отсутствия остатка: ${stockoutMonths.join(", ") || "нет"}; исключено разовых документов: ${excluded.map((doc) => doc.doc_no).join(", ") || "нет"}.`;
  return { forecast: { horizon_months: horizonDays / 30, base_rate: components.base_rate, season: components.season, growth: components.growth, stockout_uplift: components.stockout_uplift, safety: components.safety, method_ru: "Сезонный спрос × рост; цензурирование дефицита; исключение разовых документов" }, need, rationale_ru, components };
}
