"use client";
import Link from "next/link";
import { useMemo, useRef } from "react";
import { useApi } from "@/components/shell";
import { Card, Empty, Kpis, Loading, PageHead, Pill, Section, StaleBanner, Truth, Unavailable, fmtDate, fmtMoney, fmtMoneyShort, fmtNum, useRowKeys } from "@/components/v2/ui";
import styles from "./money.module.css";

type Money = { amount: string; currency: string };
type Committed = { supplier_id: string; amount: string; currency: string; lines: number; cost_known_lines: number; cost_complete?: boolean; unknown_cost_lines?: number };
type Outflow = { at: string; amount: string; currency: string; po_id: string; kind: string };
type Risk = { code: string; count: number; label_ru: string };
type MoneyResponse = { ok: true; ai: string; cash: Money[]; committed_by_supplier: Committed[]; next_60d: { out: Outflow[] }; stock_value: (Money & { cost_known_share: number | null; cost_unknown_count?: number }) | null; risks: Risk[]; state_version: number };
type Orders = { orders: { id: string; supplier_id: string; state: string; total_qty: number; total_cost: string | null; cost_known_lines: number; eta: string | null; version: number; lines?: unknown[] }[] };

const SUPPLIER: Record<string, string> = { IEK: "IEK", SE: "Systeme Electric" };
const KIND: Record<string, string> = { prepayment: "предоплата 30 %", balance: "остаток при поставке", obligation: "обязательство" };

export function MoneyPage() {
  const { data, error, loading, reload } = useApi<MoneyResponse>("/api/money");
  const orders = useApi<Orders>("/api/orders");
  const table = useRef<HTMLDivElement>(null);
  useRowKeys(table);
  const outflows = useMemo(() => [...(data?.next_60d.out ?? [])].sort((a, b) => a.at.localeCompare(b.at)), [data]);
  if (loading && !data) return <><PageHead crumbs={[{ label: "Финансы" }]} title="Деньги" /><Loading label="Загружаю денежный контур…" /></>;
  if (error && !data) return <><PageHead crumbs={[{ label: "Финансы" }]} title="Деньги" /><Unavailable title="Денежный контур недоступен" detail={`${error.message} (${error.code}). Ничего не придумываю — числа появятся, когда ответит /api/money.`} retry={reload} /></>;
  if (!data) return null;
  const cur = data.committed_by_supplier[0]?.currency ?? data.stock_value?.currency ?? "KZT";
  const committedTotal = sumByCurrency(data.committed_by_supplier);
  const outTotal = sumByCurrency(outflows);
  const cashKnown = data.cash.length > 0;
  const openingRisk = data.risks.find(r => r.code === "opening_cash_unknown");
  const costRisk = data.risks.find(r => r.code === "cost_unknown");
  const unknownLines = data.committed_by_supplier.reduce((a, c) => a + (c.unknown_cost_lines ?? c.lines - c.cost_known_lines), 0);
  const byDay = groupByDay(outflows);
  const maxDay = Math.max(1, ...byDay.map(d => d.total));
  return <>
    {error && <StaleBanner>Обновление не удалось — показываю последний снимок (версия состояния {data.state_version}).</StaleBanner>}
    <PageHead crumbs={[{ label: "Финансы" }]} title="Деньги" badges={<><Pill tone={cashKnown ? "good" : "warn"}>{cashKnown ? "касса задана" : "касса не задана"}</Pill><Pill tone={unknownLines ? "warn" : "good"}>{unknownLines ? `${fmtNum(unknownLines)} строк без себестоимости` : "себестоимость полная"}</Pill></>}
      sub={<>Обязательства по утверждённым заказам · условия: предоплата 30 % при утверждении, остаток к ETA · {data.ai === "rules" ? "Правила без LLM" : data.ai}</>} />
    <Kpis items={[
      { label: "Денежные средства", value: cashKnown ? fmtMoneyShort(data.cash[0].amount, data.cash[0].currency) : "не заданы", meta: cashKnown ? fmtMoney(data.cash[0].amount, data.cash[0].currency) : (openingRisk?.label_ru ?? "начальный остаток не передан") + " — ноль не подставляю", tone: cashKnown ? undefined : "warn" },
      { label: "Обязательства перед поставщиками", value: data.committed_by_supplier.length ? fmtMoneyShort(committedTotal, cur) : "нет", meta: data.committed_by_supplier.length ? `${data.committed_by_supplier.length} поставщик${data.committed_by_supplier.length === 1 ? "" : "а"} · ${fmtMoney(committedTotal, cur)}${unknownLines ? " · без учёта строк без цены" : ""}` : "утверждённых заказов нет" },
      { label: "Выплаты в ближайшие 60 дней", value: outflows.length ? fmtMoneyShort(outTotal, cur) : "нет дат", meta: outflows.length ? `${outflows.length} платеж${outflows.length === 1 ? "" : "а"} · первый ${fmtDate(outflows[0].at)}` : "обязательства с датой не сформированы" },
      { label: "Склад по себестоимости", value: data.stock_value ? fmtMoneyShort(data.stock_value.amount, data.stock_value.currency) : "нет", meta: data.stock_value ? `цена известна у ${Math.round((data.stock_value.cost_known_share ?? 0) * 100)} % позиций${data.stock_value.cost_unknown_count ? ` · ${fmtNum(data.stock_value.cost_unknown_count)} без цены` : ""}` : "остатки без цены", tone: data.stock_value && (data.stock_value.cost_known_share ?? 0) < 0.5 ? "warn" : undefined },
    ]} />
    <div className={styles.grid}>
      <div className={styles.main}>
        <Section id="committed" title="Обязательства по поставщикам" count={data.committed_by_supplier.length} aside={<Truth>Σ количество × себестоимость по строкам утверждённых заказов</Truth>}>
          {data.committed_by_supplier.length === 0 ? <Empty title="Утверждённых заказов пока нет">Обязательство появляется в момент утверждения заказа поставщику. До этого сумма честно отсутствует, а не равна нулю.</Empty>
            : <div className={styles.table} ref={table} role="table" aria-label="Обязательства по поставщикам">
              <div className={styles.thead} role="row"><span role="columnheader">Поставщик</span><span role="columnheader">Строк</span><span role="columnheader">С ценой</span><span role="columnheader" className={styles.right}>Сумма</span></div>
              {data.committed_by_supplier.map(c => {
                const unknown = c.unknown_cost_lines ?? c.lines - c.cost_known_lines;
                const order = orders.data?.orders.find(o => o.supplier_id === c.supplier_id && (o.state === "approved" || o.state === "exported"));
                return <div key={c.supplier_id} className={styles.rowGroup}>
                  <div className={styles.tr} role="row" data-row tabIndex={0}>
                    <span role="cell" className={styles.cellMain}><span className={styles.name}>{SUPPLIER[c.supplier_id] ?? c.supplier_id}</span><span className={styles.meta}>{order ? <Link href={`/orders/${order.id}`}>{order.id.slice(0, 11)}… · ETA {fmtDate(order.eta)}</Link> : `заказ ${c.supplier_id}`}</span></span>
                    <span role="cell" className={styles.num}>{fmtNum(c.lines)}</span>
                    <span role="cell" className={styles.num}>{fmtNum(c.cost_known_lines)}<span className={styles.meta}> из {fmtNum(c.lines)}</span></span>
                    <span role="cell" className={`${styles.num} ${styles.money}`}>{fmtMoney(c.amount, c.currency)}</span>
                  </div>
                  {unknown > 0 && <div className={styles.alertRow} role="row"><span role="cell">↳ {fmtNum(unknown)} строк без себестоимости — сумма занижена, деньги по ним не посчитаны.{c.supplier_id === "IEK" && " В файле IEK себестоимость не передаётся."}</span></div>}
                </div>;
              })}
              <div className={styles.tfoot} role="row"><span role="cell">Итого</span><span /><span /><span role="cell" className={`${styles.num} ${styles.money}`}>{fmtMoney(committedTotal, cur)}</span></div>
            </div>}
        </Section>
        <Section id="outflows" title="Выплаты в ближайшие 60 дней" count={outflows.length} aside={<Truth>по условиям поставщика · предоплата при утверждении, остаток к ETA</Truth>}>
          {outflows.length === 0 ? <Empty title="Платежей с датой нет">Расписание выплат строится из обязательств с датой (<code>obligation.due_at</code>). Их пока нет — {data.committed_by_supplier.length ? "утверждённый заказ есть, но обязательства с датой сервер не сформировал; сумма выше остаётся обязательством без графика." : "утвердите заказ поставщику, и предоплата и остаток встанут на календарь."}</Empty>
            : <Card>
              <div className={styles.days} role="img" aria-label={`Выплаты по дням, ${byDay.length} дней`}>
                {byDay.map(d => <div key={d.day} className={styles.day} title={`${fmtDate(d.day)} · ${fmtMoney(String(d.total), cur)}`}><div className={styles.dayBar} style={{ height: `${Math.max(4, (d.total / maxDay) * 100)}%` }} /><span>{fmtDate(d.day).slice(0, 5)}</span></div>)}
              </div>
              <div className={styles.table}>
                {outflows.map((o, i) => <div key={`${o.po_id}-${i}`} className={styles.tr} role="row"><span className={styles.cellMain}><span className={styles.name}>{fmtDate(o.at)}</span><span className={styles.meta}>{KIND[o.kind] ?? o.kind} · <Link href={`/orders/${o.po_id}`}>{o.po_id.slice(0, 11)}…</Link></span></span><span /><span /><span className={`${styles.num} ${styles.money}`}>{fmtMoney(o.amount, o.currency)}</span></div>)}
              </div>
            </Card>}
        </Section>
      </div>
      <aside className={styles.rail} aria-label="Риски и источники">
        <Section id="risks" title="Риски неизвестной стоимости" count={data.risks.length}>
          {data.risks.length === 0 ? <Empty title="Рисков нет" /> : <div className={styles.risks}>
            {data.risks.map(r => <Card key={r.code} tone="alert" className={styles.risk}><div className={styles.riskTop}><Pill tone="warn">{r.code === "cost_unknown" ? "себестоимость" : r.code === "opening_cash_unknown" ? "касса" : r.code}</Pill><span className={styles.riskCount}>{fmtNum(r.count)}</span></div><p className={styles.riskLabel}>{r.label_ru}</p><p className={styles.riskBody}>{r.code === "cost_unknown" ? "Позиции без цены в файле поставщика: их заказ и склад не оцениваются в деньгах. Передайте себестоимость в 1С-выгрузке." : r.code === "opening_cash_unknown" ? "Остаток денег не передан — поле «Денежные средства» остаётся пустым, а не нулём." : "Смотрите источник ниже."}</p></Card>)}
          </div>}
        </Section>
        <Section id="sources" title="Источники">
          <div className={styles.sources}>
            <p><b>Обязательства</b> — <code>purchase_order_line.qty × sku.unit_cost</code> по заказам в состоянии «утверждено» / «передано».</p>
            <p><b>Себестоимость</b> — «СС реал» из файла SE; у IEK не передаётся ({costRisk ? fmtNum(costRisk.count) : "—"} позиций без цены).</p>
            <p><b>Склад</b> — остатки на {fmtDate("2026-09-22")} × себестоимость там, где она известна.</p>
            <p><Truth>Данные партнёра · обезличены</Truth> · <Truth>Экспорт для 1С (файл)</Truth> · версия состояния {data.state_version}</p>
          </div>
        </Section>
      </aside>
    </div>
  </>;
}
function sumByCurrency(items: { amount: string }[]) { return items.reduce((a, i) => a + Number(i.amount), 0).toFixed(2); }
function groupByDay(items: Outflow[]) { const map = new Map<string, number>(); for (const o of items) { const day = o.at.slice(0, 10); map.set(day, (map.get(day) ?? 0) + Number(o.amount)); } return [...map.entries()].map(([day, total]) => ({ day, total })); }
