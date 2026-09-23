"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { ApiError, apiRequest, useApiSync } from "@/components/shell/api";
import { Btn, Empty, Loading, PageHead, Pill, Row, Rows, Unavailable, fmtMoney, fmtQty } from "./ui";

type Sku = { code_1c: string; name: string; article?: string | null; supplier_id: string; supplier_name?: string; category?: string | null; unit?: string | null; unit_cost?: string | null; moq?: number; on_hand_qty?: string | null };
type Resp = { items: Sku[]; total: number };
const LIMIT = 200;
const SUP = [["", "Все поставщики"], ["IEK", "IEK"], ["SE", "System Electric"]] as const;
const control: React.CSSProperties = { height: "var(--v2-control-h)", minWidth: 280, padding: "0 12px", border: "1px solid var(--v2-line-strong)", borderRadius: "var(--v2-r-control)", background: "var(--v2-card-raised)", color: "var(--v2-ink)", font: "var(--v2-body)" };

export function SkuIndex({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const { revision } = useApiSync();
  const [q, setQ] = useState(initialQuery);
  const [supplier, setSupplier] = useState<"" | "IEK" | "SE">("");
  const [resp, setResp] = useState<Resp>();
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); const term = q.trim();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ limit: String(LIMIT) });
      if (supplier) params.set("supplier", supplier);
      if (term) params.set("q", term);
      apiRequest<Resp>(`/api/skus?${params}`, { signal: controller.signal })
        .then(r => { setResp(r); setError(null); setLoading(false); })
        .catch(e => { if (e instanceof DOMException && e.name === "AbortError") return; setError(e instanceof ApiError ? e : new ApiError(500, "unknown", "Не удалось загрузить список товаров.")); setLoading(false); });
    }, term ? 150 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q, supplier, revision, attempt]);
  const items = resp?.items ?? [];
  return <div style={{ display: "grid", gap: 28 }}>
    <PageHead crumbs={[{ href: "/today", label: "Сегодня" }, { label: "Товары" }]} title="Товары" sub="Каталог по данным партнёра: остаток, кратность заказа и себестоимость. Откройте товар — там продажи за 24 месяца и рекомендация." actions={<Btn variant="primary" onClick={() => router.push(supplier ? `/replenishment?supplier=${supplier}` : "/replenishment")}>К пополнению <ArrowRight size={14} aria-hidden="true" /></Btn>} />
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Найти по названию или коду 1С" aria-label="Найти по названию или коду 1С" style={control} data-v2-search />
      <div role="group" aria-label="Поставщик" style={{ display: "flex", gap: 6 }}>{SUP.map(([id, label]) => <Btn key={id || "all"} variant={supplier === id ? "black" : "secondary"} aria-pressed={supplier === id} onClick={() => setSupplier(id)}>{label}</Btn>)}</div>
      {resp ? <span style={{ marginLeft: "auto", font: "var(--v2-meta)", color: "var(--v2-muted)" }}>Показано {items.length} из {resp.total}</span> : null}
    </div>
    {error && !resp ? <Unavailable title="Список товаров недоступен" detail={error.message} retry={() => setAttempt(n => n + 1)} /> : null}
    {loading && !resp ? <Loading label="Загружаю товары…" lines={6} /> : null}
    {resp && items.length === 0 ? <Empty title="Ничего не найдено">Измените запрос или выберите другого поставщика.</Empty> : null}
    {items.length ? <Rows>{items.map(s => <Row key={s.code_1c} href={`/skus/${encodeURIComponent(s.code_1c)}`} label={s.name.replace(/\s+/g, " ")} meta={`${s.code_1c}${s.article ? ` · арт. ${s.article}` : ""} · ${s.supplier_name ?? s.supplier_id}${s.category ? ` · ${s.category}` : ""}`} value={s.unit_cost ? fmtMoney(s.unit_cost) : <Pill tone="warn">себестоимость не задана</Pill>} valueMeta={`остаток ${fmtQty(s.on_hand_qty, s.unit ?? "шт")} · кратность ${fmtQty(s.moq, "шт")}`} />)}</Rows> : null}
    {resp && resp.total > items.length ? <p style={{ font: "var(--v2-meta)", color: "var(--v2-muted)", margin: 0 }}>Показаны первые {items.length} — уточните запрос, чтобы найти остальные.</p> : null}
  </div>;
}
