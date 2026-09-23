"use client";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useApi } from "@/components/shell/api";
import { Btn, Card, Loading, PageHead, Pill, Row, Rows, Unavailable, fmtMoney, fmtNum } from "./ui";

type Supplier = { id: string; lead_time_days: number; review_days: number; terms: { prepay_pct?: number }; currency: string };
type Order = { id: string; supplier_id: string; state: string; total_cost?: string | null; cost_known_lines: number; lines: { code_1c: string }[] };
const NAMES: Record<string, string> = { IEK: "IEK", SE: "System Electric" };

export function Suppliers() {
  const router = useRouter();
  const params = useApi<{ suppliers: Supplier[] }>("/api/params");
  const orders = useApi<{ orders: Order[] }>("/api/orders");
  const list = params.data?.suppliers ?? [];
  return <div style={{ display: "grid", gap: 28 }}>
    <PageHead crumbs={[{ href: "/today", label: "Сегодня" }, { label: "Поставщики" }]} title="Поставщики" sub="Условия поставки, по которым считается пополнение, и заказы у каждого поставщика." actions={<Btn variant="primary" onClick={() => router.push("/replenishment")}>К пополнению <ArrowRight size={14} aria-hidden="true" /></Btn>} />
    {params.error && !params.data ? <Unavailable title="Список поставщиков недоступен" detail={params.error.message} retry={params.reload} /> : null}
    {params.loading && !params.data ? <Loading label="Загружаю поставщиков…" lines={3} /> : null}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
      {list.map(s => {
        const own = (orders.data?.orders ?? []).filter(o => o.supplier_id === s.id);
        const drafts = own.filter(o => o.state === "draft").length;
        const approved = own.filter(o => o.state !== "draft");
        const priced = approved.filter(o => o.total_cost && o.cost_known_lines === o.lines.length);
        const committed = priced.reduce((sum, o) => sum + Number(o.total_cost), 0);
        return <Card key={s.id}>
          <div style={{ display: "grid", gap: 14, padding: "4px 4px 0" }}>
            <div><h2 style={{ font: "var(--v2-h2)", margin: 0 }}>{NAMES[s.id] ?? s.id}</h2><p style={{ font: "var(--v2-meta)", color: "var(--v2-muted)", margin: "4px 0 0" }}>Код поставщика {s.id} · валюта {s.currency}</p></div>
            <Rows>
              <Row label="Срок поставки" value={`${fmtNum(s.lead_time_days, 0)} дн.`} />
              <Row label="Период пересмотра" value={`${fmtNum(s.review_days, 0)} дн.`} />
              <Row label="Предоплата" value={s.terms?.prepay_pct != null ? `${fmtNum(s.terms.prepay_pct, 0)} %` : "—"} />
              <Row label="Заказы" value={orders.data ? `${own.length}` : "…"} valueMeta={orders.data ? `черновиков ${drafts}` : undefined} />
              <Row label="Обязательства" value={orders.data ? (priced.length ? fmtMoney(String(committed), s.currency) : approved.length ? <Pill tone="warn">себестоимость не задана</Pill> : "—") : "…"} />
            </Rows>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn variant="secondary" onClick={() => router.push(`/replenishment?supplier=${s.id}`)}>Пополнение</Btn>
              <Btn variant="secondary" onClick={() => router.push("/skus")}>Товары</Btn>
              <Btn variant="quiet" onClick={() => router.push("/orders")}>Заказы</Btn>
            </div>
          </div>
        </Card>;
      })}
    </div>
  </div>;
}
