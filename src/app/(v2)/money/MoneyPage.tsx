"use client";
import Link from "next/link";
import { useMemo, useRef } from "react";
import { useApi } from "@/components/shell";
import { Card, Empty, Kpis, Loading, PageHead, Pill, Section, StaleBanner, Truth, Unavailable, fmtDate, fmtMoney, fmtMoneyShort, fmtNum, useRowKeys } from "@/components/v2/ui";
import styles from "./money.module.css";

type Money = { amount: string; currency: string };
type Committed = { supplier_id: string; amount: string | null; currency: string; lines: number; cost_known_lines: number; cost_complete?: boolean; unknown_cost_lines?: number };
type Outflow = { at: string; amount: string; currency: string; po_id: string; kind: string };
type Risk = { code: string; count: number; label_ru: string; amount?: string; currency?: string };
type MoneyResponse = { ok: true; ai: string; cash: Money[]; committed_by_supplier: Committed[]; next_60d: { out: Outflow[] }; stock_value: (Money & { cost_known_share: number | null; cost_unknown_count?: number }) | null; risks: Risk[]; state_version: number };
type Orders = { orders: { id: string; supplier_id: string; state: string; total_qty: number; total_cost: string | null; cost_known_lines: number; eta: string | null; version: number; lines?: unknown[] }[] };

const SUPPLIER: Record<string, string> = { IEK: "IEK", SE: "Systeme Electric" };
const KIND: Record<string, string> = { prepayment: "предоплата при утверждении", supplier_prepayment: "предоплата при утверждении", balance: "остаток при поставке", supplier_balance: "остаток при поставке", obligation: "платёж по заказу" };
const AI: Record<string, string> = { rules: "Локальный режим", live: "Живой помощник", replay: "Запись", unavailable: "Локальный режим" };

function Fill({ href, children = "Заполнить" }: { href: string; children?: string }) { return <Link href={href} className={styles.fill}>{children}</Link>; }

export function MoneyPage() {
  const { data, error, loading, reload } = useApi<MoneyResponse>("/api/money");
  const orders = useApi<Orders>("/api/orders");
  const table = useRef<HTMLDivElement>(null);
  useRowKeys(table);
  const outflows = useMemo(() => [...(data?.next_60d.out ?? [])].sort((a, b) => a.at.localeCompare(b.at)), [data]);
  if (loading && !data) return <><PageHead crumbs={[{ label: "Финансы" }]} title="Деньги" /><Loading label="Загружаю деньги…" /></>;
  if (error && !data) return <><PageHead crumbs={[{ label: "Финансы" }]} title="Деньги" /><Unavailable title="Раздел «Деньги» пока недоступен" detail="Ничего не придумываем — числа появятся, как только данные ответят. Попробуйте ещё раз." retry={reload} /></>;
  if (!data) return null;
  const cur = data.committed_by_supplier[0]?.currency ?? data.stock_value?.currency ?? "KZT";
  const committedTotal = sumByCurrency(data.committed_by_supplier);
  const outTotal = sumByCurrency(outflows);
  const cashKnown = data.cash.length > 0;
  const costRisk = data.risks.find(r => r.code === "cost_unknown");
  const shortfall = data.risks.find(r => r.code === "cash_shortfall");
  const unknownLines = data.committed_by_supplier.reduce((a, c) => a + (c.unknown_cost_lines ?? c.lines - c.cost_known_lines), 0);
  const noCost = costRisk?.count ?? data.stock_value?.cost_unknown_count ?? 0;
  const gaps = [
    ...(!cashKnown ? [{ id: "cash", text: "Остаток денег на счетах", why: "чтобы видеть, хватает ли на предоплаты", href: "/settings#opening_cash" }] : []),
    ...(noCost ? [{ id: "cost", text: `Себестоимость: ${fmtNum(noCost)} товаров без цены`, why: "чтобы заказы и склад считались в деньгах, а не только в штуках", href: "/settings#cost", label: "Где взять" }] : []),
  ];
  const byDay = groupByDay(outflows);
  const maxDay = Math.max(1, ...byDay.map(d => d.total));
  return <>
    {error && <StaleBanner>Обновление не удалось — показываю последние известные данные.</StaleBanner>}
    <PageHead crumbs={[{ label: "Финансы" }]} title="Деньги" badges={<><Pill tone={cashKnown ? "good" : "warn"}>{cashKnown ? "остаток задан" : "остаток не задан"}</Pill><Pill tone={noCost ? "warn" : "good"}>{noCost ? `${fmtNum(noCost)} товаров без себестоимости` : "себестоимость полная"}</Pill></>}
      sub={<>Обязательства по утверждённым заказам · предоплата при утверждении, остаток к дате поставки · {AI[data.ai] ?? "Локальный режим"}</>} />
    {gaps.length > 0 && <Card tone="info" className={styles.gapsCard}>
      <div className={styles.gapsHead}><h2 className={styles.gapsTitle}>Что заполнить, чтобы видеть деньги полностью</h2><p className={styles.gapsSub}>Всё, что уже известно, показано ниже. Не хватает {gaps.length === 1 ? "одного" : "двух"}:</p></div>
      <ul className={styles.gaps}>{gaps.map(g => <li key={g.id}><span className={styles.gapText}><b>{g.text}</b><span className={styles.meta}>{g.why}</span></span><Fill href={g.href}>{g.label ?? "Заполнить"}</Fill></li>)}</ul>
    </Card>}
    <Kpis items={[
      { label: "Деньги на счетах", value: cashKnown ? fmtMoneyShort(data.cash[0].amount, data.cash[0].currency) : <Fill href="/settings#opening_cash" />, meta: cashKnown ? fmtMoney(data.cash[0].amount, data.cash[0].currency) : "остаток не задан — ноль не подставляем", tone: cashKnown ? undefined : "warn" },
      { label: "Обязательства перед поставщиками", value: data.committed_by_supplier.length ? fmtMoneyShort(committedTotal, cur) : "нет", meta: data.committed_by_supplier.length ? `${data.committed_by_supplier.length} поставщик${data.committed_by_supplier.length === 1 ? "" : "а"} · ${fmtMoney(committedTotal, cur)}${unknownLines ? " · без строк без цены" : ""}` : "утверждённых заказов нет" },
      { label: "Выплаты в ближайшие 60 дней", value: outflows.length ? fmtMoneyShort(outTotal, cur) : "нет дат", meta: outflows.length ? `${outflows.length} платеж${outflows.length === 1 ? "" : "а"} · первый ${fmtDate(outflows[0].at)}` : "появятся после утверждения заказа" },
      { label: "Склад по себестоимости", value: data.stock_value ? fmtMoneyShort(data.stock_value.amount, data.stock_value.currency) : <Fill href="/settings#cost">Где взять</Fill>, meta: data.stock_value ? <>цена известна у {Math.round((data.stock_value.cost_known_share ?? 0) * 100)} % позиций{data.stock_value.cost_unknown_count ? <> · {fmtNum(data.stock_value.cost_unknown_count)} без цены · <Link href="/settings#cost">где взять</Link></> : null}</> : "остатки без цены", tone: data.stock_value && (data.stock_value.cost_known_share ?? 0) < 0.5 ? "warn" : undefined },
    ]} />
    <div className={styles.grid}>
      <div className={styles.main}>
        <Section id="committed" title="Обязательства по поставщикам" count={data.committed_by_supplier.length} aside={<Truth>сумма заказа = количество × себестоимость по утверждённым заказам</Truth>}>
          {data.committed_by_supplier.length === 0 ? <Empty title="Утверждённых заказов пока нет">Обязательство появляется в момент утверждения заказа поставщику. До этого суммы честно нет, а не ноль.</Empty>
            : <div className={styles.table} ref={table} role="table" aria-label="Обязательства по поставщикам">
              <div className={styles.thead} role="row"><span role="columnheader">Поставщик</span><span role="columnheader">Строк</span><span role="columnheader">С ценой</span><span role="columnheader" className={styles.right}>Сумма</span></div>
              {data.committed_by_supplier.map(c => {
                const unknown = c.unknown_cost_lines ?? c.lines - c.cost_known_lines;
                const order = orders.data?.orders.find(o => o.supplier_id === c.supplier_id && (o.state === "approved" || o.state === "exported"));
                return <div key={c.supplier_id} className={styles.rowGroup}>
                  <div className={styles.tr} role="row" data-row tabIndex={0}>
                    <span role="cell" className={styles.cellMain}><span className={styles.name}>{SUPPLIER[c.supplier_id] ?? c.supplier_id}</span><span className={styles.meta}>{order ? <Link href={`/orders/${order.id}`}>{order.id.slice(0, 11)}… · поставка {fmtDate(order.eta)}</Link> : `заказ ${SUPPLIER[c.supplier_id] ?? c.supplier_id}`}</span></span>
                    <span role="cell" className={styles.num}>{fmtNum(c.lines)}</span>
                    <span role="cell" className={styles.num}>{fmtNum(c.cost_known_lines)}<span className={styles.meta}> из {fmtNum(c.lines)}</span></span>
                    <span role="cell" className={`${styles.num} ${styles.money}`}>{c.amount ? fmtMoney(c.amount, c.currency) : "нет цены"}</span>
                  </div>
                  {unknown > 0 && <div className={styles.alertRow} role="row"><span role="cell">↳ {fmtNum(unknown)} строк без себестоимости — сумма занижена, деньги по ним не посчитаны.{c.supplier_id === "IEK" && " В файлах IEK себестоимости нет."} <Link href="/settings#cost">Где взять</Link></span></div>}
                </div>;
              })}
              <div className={styles.tfoot} role="row"><span role="cell">Итого</span><span /><span /><span role="cell" className={`${styles.num} ${styles.money}`}>{fmtMoney(committedTotal, cur)}</span></div>
            </div>}
        </Section>
        <Section id="outflows" title="Выплаты в ближайшие 60 дней" count={outflows.length} aside={<Truth>предоплата при утверждении, остаток к дате поставки</Truth>}>
          {outflows.length === 0 ? <Empty title="Платежей с датой нет">График выплат строится по датам платежей по обязательствам. {data.committed_by_supplier.length ? "Утверждённый заказ есть, но у его платежей ещё нет дат; сумма выше остаётся обязательством без графика." : "Утвердите заказ поставщику — предоплата и остаток встанут на календарь."}</Empty>
            : <Card>
              <div className={styles.days} role="img" aria-label={`Выплаты по дням, ${byDay.length} дней`}>
                {byDay.map(d => <div key={d.day} className={styles.day} title={`${fmtDate(d.day)} · ${fmtMoney(String(d.total), cur)}`}><div className={styles.dayBar} style={{ height: `${Math.max(4, (d.total / maxDay) * 100)}%` }} /><span>{fmtDate(d.day).slice(0, 5)}</span></div>)}
              </div>
              <div className={styles.table}>
                {outflows.map((o, i) => <div key={`${o.po_id}-${i}`} className={styles.tr} role="row"><span className={styles.cellMain}><span className={styles.name}>{fmtDate(o.at)}</span><span className={styles.meta}>{KIND[o.kind] ?? "платёж по заказу"} · <Link href={`/orders/${o.po_id}`}>{o.po_id.slice(0, 11)}…</Link></span></span><span /><span /><span className={`${styles.num} ${styles.money}`}>{fmtMoney(o.amount, o.currency)}</span></div>)}
              </div>
            </Card>}
        </Section>
      </div>
      <aside className={styles.rail} aria-label="Что мешает и откуда числа">
        <Section id="risks" title="Что мешает считать полностью" count={data.risks.length}>
          {data.risks.length === 0 ? <Empty title="Ничего — все данные на месте" /> : <div className={styles.risks}>
            {data.risks.map(r => <Card key={r.code} tone="alert" className={styles.risk}>
              <div className={styles.riskTop}><Pill tone="warn">{r.code === "cost_unknown" ? "себестоимость" : r.code === "opening_cash_unknown" ? "остаток денег" : r.code === "cash_shortfall" ? "не хватает денег" : "внимание"}</Pill><span className={styles.riskCount}>{r.code === "cash_shortfall" && r.amount ? fmtMoneyShort(r.amount, r.currency) : fmtNum(r.count)}</span></div>
              <p className={styles.riskLabel}>{r.label_ru}</p>
              <p className={styles.riskBody}>{r.code === "cost_unknown" ? "У этих товаров нет цены в выгрузке, поэтому их заказ и склад не оцениваются в деньгах." : r.code === "opening_cash_unknown" ? "Пока остаток не задан, поле «Деньги на счетах» остаётся пустым, а не нулём." : r.code === "cash_shortfall" ? "Выплаты в ближайшие 60 дней больше, чем денег на счетах. Проверьте остаток или сдвиньте заказ." : "Смотрите раздел «Откуда числа»."}</p>
              {r.code === "cost_unknown" && <Fill href="/settings#cost">Где взять</Fill>}
              {(r.code === "opening_cash_unknown" || r.code === "cash_shortfall") && <Fill href="/settings#opening_cash">{r.code === "cash_shortfall" ? "Проверить остаток" : "Заполнить"}</Fill>}
            </Card>)}
          </div>}
        </Section>
        <Section id="sources" title="Откуда числа">
          <div className={styles.sources}>
            <p><b>Обязательства</b> — сумма заказа = количество × себестоимость по заказам в состоянии «утверждено» или «передано».</p>
            <p><b>Себестоимость</b> — из выгрузки Systeme Electric; у IEK не передаётся{costRisk ? ` (${fmtNum(costRisk.count)} товаров без цены)` : ""}.</p>
            <p><b>Склад</b> — остатки на {fmtDate("2026-09-22")} × себестоимость там, где она известна.</p>
            <p><b>Выплаты</b> — дата платежа по обязательству: предоплата в день утверждения, остаток к дате поставки.</p>
            <p><Truth>Данные партнёра · обезличены</Truth> · <Link href="/settings#sources">Настройки → Откуда данные</Link></p>
          </div>
        </Section>
      </aside>
    </div>
  </>;
}
function sumByCurrency(items: { amount: string | null }[]) { return items.reduce((a, i) => a + Number(i.amount ?? 0), 0).toFixed(2); }
function groupByDay(items: Outflow[]) { const map = new Map<string, number>(); for (const o of items) { const day = o.at.slice(0, 10); map.set(day, (map.get(day) ?? 0) + Number(o.amount)); } return [...map.entries()].map(([day, total]) => ({ day, total })); }
