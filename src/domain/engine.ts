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

type Sku = { code_1c: string; supplier_id: string; name: string; unit: string | null; moq: number; months_with_sales: number | null; median_month_qty: string | null; p95_doc_qty: string | null;
  on_hand_qty: string | null; on_hand_as_of: string | null };
type Month = { ym: string; qty_file: string | null; qty_regular: string | null; stockout: number; stockout_kind: string | null };
type Sale = { doc_no: string | null; at: string; qty: string; id: number; source: string };
type Outlier = { doc_no: string | null; at: string | null; state: string };

function dec(value: string | number | null | undefined): Decimal { return new Decimal(value ?? 0); }
function numeric(value: Decimal): number { return +value.toString(); }
function monthOf(day: string): string { return day.slice(0, 7); }
function monthIndex(ym: string): number { return parseInt(ym.slice(5, 7), 10); }
function monthGap(later: string, earlier: string): number {
  return (parseInt(later.slice(0, 4), 10) - parseInt(earlier.slice(0, 4), 10)) * 12 + monthIndex(later) - monthIndex(earlier);
}
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
  const sku = database.prepare("SELECT code_1c,supplier_id,name,unit,moq,months_with_sales,median_month_qty,p95_doc_qty,on_hand_qty,on_hand_as_of FROM sku WHERE code_1c=?").get(code_1c) as Sku | undefined;
  if (!sku) throw new Error(`SKU ${code_1c} is missing`);
  const unit = sku.unit?.trim() || "шт";
  const orderRule = sku.supplier_id === "IEK" ? "минимум" : "кратность";
  if (params.lead_time_days < 1 || params.review_days < 0 || params.growth_cap < 0 || params.outlier.min_units < 0 || sku.moq < 1) throw new RangeError("invalid engine parameters");
  const months = database.prepare("SELECT ym,qty_file,qty_regular,stockout,stockout_kind FROM sales_month WHERE code_1c=? AND ym<=? ORDER BY ym")
    .all(code_1c, monthOf(asOf)) as Month[];
  const sales = database.prepare("SELECT id,doc_no,at,qty,source FROM sales_line WHERE code_1c=? AND at<=? AND (doc_type IN ('Расходная накладная','sales_day','judge_message') OR doc_type IS NULL) ORDER BY at,id")
    .all(code_1c, `${asOf}T23:59:59`) as Sale[];
  const noSalesHistory = !months.length && !sales.length;
  if (noSalesHistory && ((sku.months_with_sales ?? 0) > 0 || sku.median_month_qty !== null))
    throw new Error(`sales source missing for ${code_1c}`);
  const latestStock = database.prepare("SELECT ym,known FROM stock_month WHERE code_1c=? AND ym<=? ORDER BY ym DESC LIMIT 1")
    .get(code_1c, monthOf(asOf)) as { ym: string; known: number } | undefined;
  const stock = database.prepare("SELECT ym,opening_qty FROM stock_month WHERE code_1c=? AND ym<=? AND known=1 ORDER BY ym DESC LIMIT 1")
    .get(code_1c, monthOf(asOf)) as { ym: string; opening_qty: string | null } | undefined;
  const snapshotAge = sku.on_hand_as_of ? (Date.parse(asOf) - Date.parse(sku.on_hand_as_of.slice(0, 10))) / 86_400_000 : Infinity;
  const freshOnHand = sku.on_hand_qty !== null && sku.on_hand_as_of !== null && snapshotAge >= 0 && snapshotAge <= 31;
  if (!stock || stock.opening_qty === null) throw new Error(`stock source missing for ${code_1c}`);
  const stockMonth = stock.ym;
  const stockStale = !freshOnHand && (!latestStock || latestStock.known !== 1 || latestStock.ym !== stockMonth || monthGap(monthOf(asOf), stockMonth) > 1);
  const allTransitRows = database.prepare("SELECT po_ref,qty,expected_at,source_file FROM in_transit WHERE code_1c=?").all(code_1c) as
    { po_ref: string; qty: string; expected_at: string | null; source_file: string | null }[];
  const horizonDate = dateUTC(asOf);
  horizonDate.setUTCDate(horizonDate.getUTCDate() + params.lead_time_days + params.review_days);
  const transitRows = allTransitRows.filter((row) => !row.expected_at || row.expected_at.slice(0, 10) <= horizonDate.toISOString().slice(0, 10));
  const transit = transitRows.reduce((sum, row) => sum.plus(row.qty), new Decimal(0));
  const approvedRows = database.prepare(`SELECT p.id po_id,p.eta,l.qty FROM purchase_order_line l
    JOIN purchase_order p ON p.id=l.po_id WHERE l.code_1c=? AND p.state IN ('approved','exported')
    AND p.eta IS NOT NULL AND substr(p.eta,1,10)>=? AND substr(p.eta,1,10)<=?`)
    .all(code_1c, asOf, horizonDate.toISOString().slice(0, 10)) as { po_id: string; eta: string; qty: number }[];
  const approvedSupply = approvedRows.reduce((sum, row) => sum.plus(row.qty), new Decimal(0));
  const onHand = dec(freshOnHand ? sku.on_hand_qty : stock?.opening_qty);
  if (noSalesHistory || (months.length > 0 && months.every((month) => dec(month.qty_file ?? month.qty_regular).isZero()) && sales.every((sale) => dec(sale.qty).isZero()))) {
    const flags = ["inactive"];
    const components = { flags, source_months: months.length, sales_lines: sales.length, stock_month: stockMonth, stock_stale: stockStale,
      on_hand: numeric(onHand), on_hand_as_of: freshOnHand ? sku.on_hand_as_of : `${stockMonth}-01`, in_transit: numeric(transit),
      approved_order_qty: numeric(approvedSupply), approved_order_sources: approvedRows,
      transit_rows: transitRows.length, in_transit_sources: transitRows, forecast_qty: 0, safety: 0, raw_need: 0, net_need: numeric(onHand.negated().minus(transit)),
      moq: sku.moq, unit, order_rule: orderRule, urgency: "none", outliers_excluded: [], stockout_months: [] };
    return { forecast: { horizon_months: (params.lead_time_days + params.review_days) / 30, base_rate: 0, season: {}, growth: 1,
      stockout_uplift: 0, safety: 0, method_ru: "Нет продаж за период" }, need: 0,
      rationale_ru: `Код 1С ${code_1c}: нет продаж за период — заказ не требуется`, flags, components };
  }

  const existing = database.prepare("SELECT doc_no,at,state FROM outlier_doc WHERE code_1c=?").all(code_1c) as Outlier[];
  const outlierState = new Map(existing.map((row) => [`${row.doc_no}|${row.at?.slice(0, 7)}`, row.state]));
  const docGroups = new Map<string, { doc_no: string; ym: string; qty: Decimal; source: string }>();
  for (const sale of sales) {
    const ym = monthOf(sale.at);
    const docNo = sale.doc_no ?? `line:${sale.id}`;
    const key = `${docNo}|${ym}`;
    const group = docGroups.get(key) ?? { doc_no: docNo, ym, qty: new Decimal(0), source: sale.source };
    group.qty = group.qty.plus(sale.qty);
    docGroups.set(key, group);
  }
  const fileMonths = months.map((month) => dec(month.qty_file)).filter((qty) => qty.gt(0));
  const positiveDocs = [...docGroups.values()].map((doc) => doc.qty).filter((qty) => qty.gt(0)).sort((a, b) => a.comparedTo(b));
  const medianMonth = sku.median_month_qty ? dec(sku.median_month_qty) : median(fileMonths);
  // Compare each document with its peers; an injected document cannot raise its own cutoff.
  const peerStat = (candidate: Decimal): Decimal => {
    let low = 0, high = positiveDocs.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (positiveDocs[middle].lt(candidate)) low = middle + 1;
      else high = middle;
    }
    const excludedIndex = low < positiveDocs.length && positiveDocs[low].eq(candidate) ? low : -1;
    const peerCount = positiveDocs.length - (excludedIndex >= 0 ? 1 : 0);
    if (!peerCount) return new Decimal(params.outlier.min_units).div(params.outlier.k_doc || 1);
    const peerAt = (index: number) => positiveDocs[index >= excludedIndex && excludedIndex >= 0 ? index + 1 : index];
    if (positiveDocs.length < 6) {
      const middle = Math.floor(peerCount / 2);
      return peerCount % 2 ? peerAt(middle) : peerAt(middle - 1).plus(peerAt(middle)).div(2);
    }
    return peerAt(Math.ceil(peerCount * 0.95) - 1);
  };
  const thresholdFor = (candidate: Decimal): Decimal => Decimal.max(params.outlier.min_units,
    Decimal.min(medianMonth.times(params.outlier.k_month), peerStat(candidate).times(params.outlier.k_doc)));
  const referenceDoc = positiveDocs.at(-1) ?? new Decimal(0);
  const p95Doc = peerStat(referenceDoc);
  const threshold = thresholdFor(referenceDoc);
  const byMonth = new Map<string, Decimal>();
  const worldDelta = new Map<string, Decimal>();
  const excludedFromFile = new Map<string, Decimal>();
  const excluded: { doc_no: string; ym: string; qty: number; threshold: number }[] = [];
  for (const doc of docGroups.values()) {
    const state = outlierState.get(`${doc.doc_no}|${doc.ym}`);
    const docThreshold = thresholdFor(doc.qty);
    if (state === "excluded" || (state !== "kept" && doc.qty.gt(docThreshold))) {
      excluded.push({ doc_no: doc.doc_no, ym: doc.ym, qty: numeric(doc.qty), threshold: numeric(docThreshold) });
      if (doc.source !== "judge") excludedFromFile.set(doc.ym, (excludedFromFile.get(doc.ym) ?? new Decimal(0)).plus(doc.qty));
      continue;
    }
    byMonth.set(doc.ym, (byMonth.get(doc.ym) ?? new Decimal(0)).plus(doc.qty));
    if (doc.source === "world" || doc.source === "judge") worldDelta.set(doc.ym, (worldDelta.get(doc.ym) ?? new Decimal(0)).plus(doc.qty));
  }
  const series = months.map((month) => ({
    ym: month.ym,
    qty: month.qty_regular !== null ? Decimal.max(0, dec(month.qty_regular).plus(worldDelta.get(month.ym) ?? 0)) : month.qty_file !== null
      ? Decimal.max(0, dec(month.qty_file).minus(excludedFromFile.get(month.ym) ?? 0).plus(worldDelta.get(month.ym) ?? 0))
      : (byMonth.get(month.ym) ?? new Decimal(0)),
    stockout: month.stockout === 1,
    stockout_kind: month.stockout_kind,
  }));
  if (!series.length) {
    for (const [ym, qty] of [...byMonth].sort(([a], [b]) => a.localeCompare(b))) series.push({ ym, qty, stockout: false, stockout_kind: null });
  }
  const uncensored = series.filter((point) => !point.stockout);
  if (!uncensored.length) throw new Error(`uncensored sales source missing for ${code_1c}`);
  const baseRate = uncensored.reduce((sum, point) => sum.plus(point.qty), new Decimal(0)).div(uncensored.length);
  const stockoutMonths = series.filter((point) => point.stockout).map((point) => point.ym);
  const inferredStockoutMonths = series.filter((point) => point.stockout_kind === "inferred").map((point) => point.ym);
  const stockoutUplift = series.filter((point) => point.stockout)
    .reduce((sum, point) => sum.plus(Decimal.max(0, baseRate.minus(point.qty))), new Decimal(0));
  const rawObservedRate = series.reduce((sum, point) => sum.plus(point.qty), new Decimal(0)).div(series.length);

  const supplierSeason = database.prepare("SELECT month,idx FROM season_index WHERE supplier_id=?").all(sku.supplier_id) as { month: number; idx: string }[];
  const ownSeason = uncensored.filter((point) => point.qty.gt(0)).length >= 12;
  const season = new Map<number, Decimal>(supplierSeason.map((row) => [row.month, dec(row.idx)]));
  if (ownSeason && baseRate.gt(0)) {
    for (let month = 1; month <= 12; month++) {
      const peers = uncensored.filter((point) => monthIndex(point.ym) === month);
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
  const netNeed = forecastQty.plus(safety).minus(onHand).minus(transit).minus(approvedSupply);
  const rawNeed = Decimal.max(0, netNeed);
  const need = rawNeed.isZero() ? 0 : numeric(sku.supplier_id === "IEK"
    ? Decimal.max(rawNeed.ceil(), sku.moq) : rawNeed.div(sku.moq).ceil().times(sku.moq));
  const dailyRate = baseRate.times(growth).div(30);
  const coverDays = dailyRate.gt(0) ? onHand.plus(transit).plus(approvedSupply).div(dailyRate) : null;
  const urgency = need === 0 ? "none" : !coverDays || coverDays.lt(params.lead_time_days) ? "critical" : coverDays.lt(horizonDays) ? "soon" : "normal";
  const components = {
    source_months: series.length, sales_lines: sales.length, stock_month: stockMonth, stock_stale: stockStale, transit_rows: transitRows.length,
    base_rate: numeric(baseRate.toDecimalPlaces(3)), season_source: ownSeason ? "sku" : "supplier",
    season: Object.fromEntries([...season].map(([month, index]) => [month, numeric(index.toDecimalPlaces(3))])),
    growth: numeric(growth.toDecimalPlaces(3)), horizon_days: horizonDays,
    forecast_qty: numeric(forecastQty.toDecimalPlaces(3)), monthly_forecast: Object.fromEntries([...monthlyForecast].map(([ym, qty]) => [ym, numeric(qty.toDecimalPlaces(3))])),
    stockout_months: stockoutMonths, inferred_stockout_months: inferredStockoutMonths,
    raw_demand_rate: numeric(rawObservedRate.toDecimalPlaces(3)), corrected_demand_rate: numeric(baseRate.toDecimalPlaces(3)),
    stockout_uplift: numeric(stockoutUplift.toDecimalPlaces(3)),
    outliers_excluded: excluded, median_month_qty: numeric(medianMonth), p95_doc_qty: numeric(p95Doc), outlier_threshold: numeric(threshold),
    safety: numeric(safety.toDecimalPlaces(3)), on_hand: numeric(onHand), on_hand_as_of: freshOnHand ? sku.on_hand_as_of : `${stockMonth}-01`, in_transit: numeric(transit),
    in_transit_sources: transitRows, in_transit_excluded_late: allTransitRows.filter((row) => !transitRows.includes(row)),
    approved_order_qty: numeric(approvedSupply), approved_order_sources: approvedRows,
    net_need: numeric(netNeed.toDecimalPlaces(6)), raw_need: numeric(rawNeed.toDecimalPlaces(3)), moq: sku.moq, unit, order_rule: orderRule, urgency,
    raw_observed_forecast: baseRate.gt(0) ? numeric(forecastQty.times(rawObservedRate).div(baseRate).toDecimalPlaces(3)) : 0,
    days_of_cover: coverDays ? numeric(coverDays.toDecimalPlaces(1)) : null,
  };
  const arrivals = transitRows.filter((row) => row.expected_at).map((row) => `${row.qty} ${unit} прибудет до ${row.expected_at!.slice(8, 10)}.${row.expected_at!.slice(5, 7)}`);
  const rationale_ru = `Код 1С ${code_1c}: фактические продажи ${components.raw_demand_rate} ${unit}/мес; спрос с учётом подтверждённого дефицита ${components.corrected_demand_rate} ${unit}/мес; сезонность ${ownSeason ? "артикула" : "поставщика"}, рост ×${components.growth}; прогноз на ${horizonDays} дн ${components.forecast_qty} + запас ${components.safety} − остаток ${components.on_hand} − в пути ${components.in_transit} − утверждённый заказ ${components.approved_order_qty} ${unit} = потребность ${need} ${unit} (${orderRule} ${sku.moq} ${unit}). ${arrivals.length ? `Ожидаемые поставки: ${arrivals.join(", ")}. ` : ""}Без продаж из-за подтверждённого отсутствия остатка: ${stockoutMonths.join(", ") || "нет"}; месяцы с неизвестным остатком: ${inferredStockoutMonths.join(", ") || "нет"}; исключены разовые документы: ${excluded.map((doc) => doc.doc_no).join(", ") || "нет"}.${stockStale ? ` Последний подтверждённый остаток ${stockMonth}; текущий остаток неизвестен, заказ требует уточнения.` : ""}`;
  return { forecast: { horizon_months: horizonDays / 30, base_rate: components.base_rate, season: components.season, growth: components.growth, stockout_uplift: components.stockout_uplift, safety: components.safety, method_ru: "Сезонный спрос × рост; цензурирование дефицита; исключение разовых документов" }, need, rationale_ru, components };
}
