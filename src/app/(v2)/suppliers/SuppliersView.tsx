"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useApi } from "@/components/shell";
import { Card, Empty, Kpis, Loading, PageHead, Pill, Row, Rows, Section, StaleBanner, Truth, Unavailable, fmtDate, fmtMoney, fmtMoneyShort, fmtNum } from "@/components/v2/ui";
import styles from "./suppliers.module.css";

type SupplierCard = {
  id: string; name: string; lead_time_days: number; review_days: number; currency: string;
  terms: { prepay_pct: number; balance_pct: number }; origin_ru: string | null;
  open_orders: { count: number; draft: number; approved: number; exported: number; units: number; ids: string[] };
  proposals_waiting: number;
  in_transit: { units: number; shipments: number; next_eta: string | null };
  committed: { amount: string | null; currency: string; lines: number; cost_known_lines: number } | null;
  next_payment: { kind: string; amount: string; currency: string; at: string | null } | null;
  last_reply: { at: string | null; text: string | null; po_id: string | null } | null;
};
type Resp = { suppliers: SupplierCard[] };

const CURRENCY_RU: Record<string, string> = { KZT: "тенге (₸)", RUB: "рубли (₽)", USD: "доллары ($)", EUR: "евро (€)" };
const plural = (n: number, one: string, few: string, many: string) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many; };
const when = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };

function Supplier({ c }: { c: SupplierCard }) {
  const o = c.open_orders;
  const waiting = c.proposals_waiting ? `${fmtNum(c.proposals_waiting)} ${plural(c.proposals_waiting, "предложение ждёт", "предложения ждут", "предложений ждут")} вашего решения` : "";
  const payKind = c.next_payment?.kind === "supplier_prepayment" ? `Предоплата ${fmtNum(c.terms.prepay_pct)} %` : c.next_payment?.kind === "supplier_balance" ? "Остаток при поставке" : "Выплата";
  return <Card className={styles.card}>
    <div className={styles.cardHead}>
      <div>
        <h2 className={styles.name} id={`sup-${c.id}`}>{c.name}{c.name !== c.id && <small>{c.id}</small>}</h2>
        <p className={styles.origin}>{c.origin_ru ? `Поставщик · ${c.origin_ru}` : "Поставщик"}</p>
      </div>
      <Pill tone={o.count ? "warn" : "good"}>{o.count ? `${fmtNum(o.count)} ${plural(o.count, "открытый заказ", "открытых заказа", "открытых заказов")}` : "открытых заказов нет"}</Pill>
    </div>
    <Rows>
      <Row label="Срок поставки" meta={`заказ пересматриваем раз в ${fmtNum(c.review_days)} ${plural(c.review_days, "день", "дня", "дней")}`} value={<span className={styles.big}>{fmtNum(c.lead_time_days)}<span className={styles.unit}>дн</span></span>} />
      <Row label="Открытые заказы" href={`/orders?supplier=${encodeURIComponent(c.id)}`}
        meta={o.count ? `черновиков ${fmtNum(o.draft)} · утверждено ${fmtNum(o.approved)} · передано в 1С ${fmtNum(o.exported)}${waiting ? ` · ${waiting}` : ""}` : waiting || "появятся после утверждения предложения"}
        value={<span className={styles.big}>{fmtNum(o.count)}</span>} valueMeta={o.count ? `${fmtNum(o.units)} шт` : undefined} />
      <Row label="В пути" meta={c.in_transit.shipments ? `${fmtNum(c.in_transit.shipments)} ${plural(c.in_transit.shipments, "поставка", "поставки", "поставок")}${c.in_transit.next_eta ? ` · ближайшая ${fmtDate(c.in_transit.next_eta)}` : ""}` : "ничего не едет"}
        value={<span className={styles.big}>{fmtNum(c.in_transit.units)}<span className={styles.unit}>шт</span></span>} />
      <Row label="Обязательства" meta={c.committed ? `${fmtNum(c.committed.lines)} ${plural(c.committed.lines, "строка", "строки", "строк")} · цена известна для ${fmtNum(c.committed.cost_known_lines)}` : "появятся после утверждения заказа"}
        value={c.committed?.amount ? <span className={styles.big}>{fmtMoneyShort(c.committed.amount, c.committed.currency)}</span> : c.committed ? <span className={styles.nocost}>себестоимость не задана</span> : <span className={styles.big}>нет</span>}
        valueMeta={c.committed?.amount ? fmtMoney(c.committed.amount, c.committed.currency) : undefined} />
      {c.next_payment && <Row label={payKind} meta={c.next_payment.at ? `к ${fmtDate(c.next_payment.at)}` : undefined} value={<span className={styles.big}>−{fmtMoney(c.next_payment.amount, c.next_payment.currency)}</span>} />}
    </Rows>
    <div className={styles.block}>
      <h3 className={styles.blockTitle}>Условия</h3>
      <dl className={styles.terms} aria-label={`Условия · ${c.name}`}>
        <dt>Валюта</dt><dd>{CURRENCY_RU[c.currency] ?? c.currency}</dd>
        <dt>Предоплата при утверждении</dt><dd>{fmtNum(c.terms.prepay_pct)} %</dd>
        <dt>Остаток при получении</dt><dd>{fmtNum(c.terms.balance_pct)} %</dd>
        <dt>Страна</dt><dd>{c.origin_ru ?? "не указана"}</dd>
      </dl>
    </div>
    <div className={styles.block}>
      <h3 className={styles.blockTitle}>Последний ответ</h3>
      {c.last_reply ? <>
        <p className={styles.reply}>{c.last_reply.text ?? "Ответ получен"}</p>
        <p className={styles.replyMeta}>{when(c.last_reply.at)}{c.last_reply.po_id && <> · <Link href={`/supplier/${encodeURIComponent(c.last_reply.po_id)}`} prefetch={false}>заказ {c.last_reply.po_id}</Link></>}</p>
      </> : <p className={styles.none}>ответов пока нет</p>}
    </div>
    <div className={styles.actions}>
      <Link href={`/replenishment?supplier=${encodeURIComponent(c.id)}`} prefetch={false} className={`${styles.btn} ${styles.btnBlack}`}>Закупки {c.id}<ArrowRight size={14} aria-hidden="true" /></Link>
      <Link href={`/orders?supplier=${encodeURIComponent(c.id)}`} prefetch={false} className={styles.btn}>Заказы {c.id}</Link>
    </div>
  </Card>;
}

export function SuppliersView() {
  const { data, error, loading, reload } = useApi<Resp>("/api/suppliers");
  const crumbs = [{ label: "Закупки" }];
  if (loading && !data) return <><PageHead crumbs={crumbs} title="Поставщики" /><Loading label="Загружаю поставщиков…" /></>;
  if (error && !data) return <><PageHead crumbs={crumbs} title="Поставщики" /><Unavailable title="Данные о поставщиках недоступны" detail="Ничего не придумываю — карточки появятся, когда данные ответят." retry={reload} /></>;
  if (!data) return null;
  const cards = data.suppliers;
  const open = cards.reduce((n, c) => n + c.open_orders.count, 0);
  const transit = cards.reduce((n, c) => n + c.in_transit.units, 0);
  const committed = cards.filter(c => c.committed?.amount);
  const committedTotal = committed.reduce((n, c) => n + Number(c.committed!.amount), 0);
  const cur = committed[0]?.committed?.currency ?? cards[0]?.currency ?? "KZT";
  const replies = cards.filter(c => c.last_reply).length;
  return <>
    {error && <StaleBanner>Обновление не удалось — показываю последний снимок.</StaleBanner>}
    <PageHead crumbs={crumbs} title="Поставщики"
      badges={<><Pill tone={open ? "warn" : "good"}>{open ? `${fmtNum(open)} ${plural(open, "открытый заказ", "открытых заказа", "открытых заказов")}` : "открытых заказов нет"}</Pill><Pill tone="neutral">{transit ? `${fmtNum(transit)} шт в пути` : "в пути ничего нет"}</Pill></>}
      sub={<>Сроки, условия оплаты, открытые заказы и деньги по каждому поставщику · предоплата при утверждении, остаток при получении</>}
      actions={<Link href="/replenishment" prefetch={false} className={`${styles.btn} ${styles.btnPrimary}`}>Пополнение<ArrowRight size={14} aria-hidden="true" /></Link>} />
    <Kpis items={[
      { label: "Поставщиков", value: fmtNum(cards.length), meta: cards.map(c => c.id).join(" · ") || "пока нет" },
      { label: "Открытые заказы", value: open ? fmtNum(open) : "нет", meta: open ? `${fmtNum(cards.reduce((n, c) => n + c.open_orders.units, 0))} шт в заказах` : "появятся после утверждения предложений" },
      { label: "В пути", value: transit ? `${fmtNum(transit)} шт` : "нет", meta: transit ? `${fmtNum(cards.reduce((n, c) => n + c.in_transit.shipments, 0))} ${plural(cards.reduce((n, c) => n + c.in_transit.shipments, 0), "поставка", "поставки", "поставок")}` : "ничего не едет" },
      { label: "Обязательства", value: committed.length ? fmtMoneyShort(String(committedTotal), cur) : "нет", meta: committed.length ? fmtMoney(String(committedTotal), cur) : "появятся после утверждения заказа" },
    ]} />
    <Section id="suppliers" title="Карточки поставщиков" count={cards.length} aside={<Truth>{replies ? `${fmtNum(replies)} ${plural(replies, "поставщик ответил", "поставщика ответили", "поставщиков ответили")}` : "ответов пока нет"} · данные партнёра · обезличены</Truth>}>
      {cards.length === 0 ? <Empty title="Поставщиков пока нет">Карточки появятся, когда данные загрузятся.</Empty>
        : <div className={styles.grid} aria-label="Поставщики">{cards.map(c => <Supplier key={c.id} c={c} />)}</div>}
    </Section>
  </>;
}
