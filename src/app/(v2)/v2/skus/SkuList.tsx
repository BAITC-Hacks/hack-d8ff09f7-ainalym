"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useApi } from "@/components/shell";
import { Empty, Loading, PageHead, Pill, Row, Rows, Section, Truth, Unavailable, fmtDate, fmtMoney, fmtQty } from "@/components/v2/ui";

type Item = { code_1c: string; supplier_id: string; supplier_name?: string; article: string | null; name: string; unit: string | null; unit_cost: string | null; moq: number; on_hand_qty: string | null; on_hand_as_of: string | null };
type Resp = { ok: true; items: Item[]; total: number };
const SUPPLIERS = [{ id: "", label: "Все" }, { id: "SE", label: "SE" }, { id: "IEK", label: "IEK" }];

export function SkuList() {
  const params = useSearchParams();
  const [q, setQ] = useState(params?.get("q") ?? "");
  const [supplier, setSupplier] = useState("");
  const query = new URLSearchParams({ limit: "100", ...(q.trim() ? { q: q.trim() } : {}), ...(supplier ? { supplier } : {}) }).toString();
  const { data, error, loading, reload } = useApi<Resp>(`/api/skus?${query}`);
  const items = data?.items ?? [];
  return <>
    <PageHead crumbs={[{ label: "Товары" }]} title="Товары" sub={data ? <>{data.total} позиций в данных партнёра · <Truth>обезличены</Truth></> : undefined} />
    <Section title="Каталог" count={data?.total} aside={
      <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {SUPPLIERS.map(s => <button key={s.id} type="button" onClick={() => setSupplier(s.id)} aria-pressed={supplier === s.id} style={{ font: "inherit", background: supplier === s.id ? "var(--v2-rail-active)" : "transparent", border: "1px solid var(--v2-line)", borderRadius: "var(--v2-r-pill)", padding: "4px 12px", color: "var(--v2-ink)", cursor: "pointer" }}>{s.label}</button>)}
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Название или код" aria-label="Фильтр по названию или коду" style={{ font: "inherit", height: "var(--v2-control-h)", padding: "0 12px", border: "1px solid var(--v2-line)", borderRadius: "var(--v2-r-control)", background: "var(--v2-card-raised)", color: "var(--v2-ink)", minWidth: 220 }} />
      </span>
    }>
      {loading && !data ? <Loading label="Загружаю товары…" />
        : error && !data ? <Unavailable title="Список товаров недоступен" detail="Не удалось получить данные. Попробуйте ещё раз." retry={reload} />
        : items.length === 0 ? <Empty title="Ничего не найдено">Измените запрос или снимите фильтр по поставщику.</Empty>
        : <Rows>
          {items.map(s => <Row key={s.code_1c} href={`/v2/skus/${encodeURIComponent(s.code_1c)}`}
            label={s.name}
            meta={<>{s.code_1c}{s.article ? ` · арт. ${s.article}` : ""} · <Pill tone="neutral">{s.supplier_name ?? s.supplier_id}</Pill>{s.moq > 1 ? ` · кратность ${s.moq}` : ""}</>}
            value={fmtQty(s.on_hand_qty, s.unit ?? "шт")}
            valueMeta={<>{s.on_hand_as_of ? `на складе на ${fmtDate(s.on_hand_as_of)}` : "остаток не известен"}{s.unit_cost ? ` · ${fmtMoney(s.unit_cost)}` : " · цена не задана"}</>} />)}
        </Rows>}
      {data && data.total > items.length && <p style={{ font: "var(--v2-meta)", color: "var(--v2-muted)", marginTop: 12 }}>Показаны первые {items.length} из {data.total}. Уточните запрос, чтобы найти нужную позицию.</p>}
    </Section>
  </>;
}
