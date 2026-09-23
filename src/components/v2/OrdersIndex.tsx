"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useApi } from "@/components/shell/api";
import { Btn, Empty, Loading, PageHead, Pill, PO_STATE, Row, Rows, Unavailable, fmtDate, fmtMoney, fmtQty } from "./ui";

type Order = { id: string; supplier_id: string; state: string; total_qty: number | string; total_cost?: string | null; cost_known_lines: number; eta?: string | null; version: number; lines: { code_1c: string }[] };
const NAMES: Record<string, string> = { IEK: "IEK", SE: "System Electric" };
const TABS = [["draft", "Черновики"], ["approved", "Утверждённые"], ["exported", "Переданные"], ["all", "Все"]] as const;

export function OrdersIndex() {
  const router = useRouter();
  const api = useApi<{ orders: Order[] }>("/api/orders");
  const orders = api.data?.orders ?? [];
  const counts: Record<string, number> = { all: orders.length };
  for (const o of orders) counts[o.state] = (counts[o.state] ?? 0) + 1;
  const [tab, setTab] = useState<string>("draft");
  const rows = orders.filter(o => tab === "all" || o.state === tab);
  return <div style={{ display: "grid", gap: 28 }}>
    <PageHead crumbs={[{ href: "/today", label: "Сегодня" }, { label: "Заказы" }]} title="Заказы" sub="Заказы поставщикам, которые выросли из рекомендаций: черновики ждут утверждения, утверждённые становятся обязательствами, переданные ушли поставщику." actions={<Btn variant="primary" onClick={() => router.push("/today")}>К решениям <ArrowRight size={14} aria-hidden="true" /></Btn>} />
    <div role="group" aria-label="Состояние заказа" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{TABS.map(([key, label]) => <Btn key={key} variant={tab === key ? "black" : "secondary"} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}{api.data ? ` · ${counts[key] ?? 0}` : ""}</Btn>)}</div>
    {api.error && !api.data ? <Unavailable title="Список заказов недоступен" detail={api.error.message} retry={api.reload} /> : null}
    {api.loading && !api.data ? <Loading label="Загружаю заказы…" lines={4} /> : null}
    {api.data && rows.length === 0 ? <Empty title={orders.length ? "В этом состоянии заказов нет" : "Заказов пока нет"}>{orders.length ? "Посмотрите другие вкладки." : "Утвердите предложение на странице «Сегодня» — появится черновик заказа."}</Empty> : null}
    {rows.length ? <Rows>{rows.map(o => {
      const st = PO_STATE[o.state] ?? { label: "В работе", tone: "neutral" as const };
      const priced = o.total_cost && o.cost_known_lines === o.lines.length;
      return <Row key={o.id} href={`/orders/${encodeURIComponent(o.id)}`} label={`Заказ ${o.id}`} meta={<>{NAMES[o.supplier_id] ?? o.supplier_id} · {o.lines.length} позиций · {fmtQty(o.total_qty)} · <Pill tone={st.tone}>{st.label}</Pill></>} value={priced ? fmtMoney(String(o.total_cost)) : <Pill tone="warn">себестоимость не задана</Pill>} valueMeta={o.eta ? `поставка ${fmtDate(o.eta)}` : "срок поставки — после утверждения"} />;
    })}</Rows> : null}
  </div>;
}
