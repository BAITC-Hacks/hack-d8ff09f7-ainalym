"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { ApiError, apiRequest, useApiSync } from "@/components/shell/api";
import { Btn, Empty, Loading, PageHead, Pill, Unavailable, fmtMoney, fmtQty } from "./ui";
import ui from "./ui.module.css";
import t from "./SkuIndex.module.css";

/** Product thumbnail (public /sku/*.jpg or category fallback from /api/skus); neutral placeholder when the catalogue has no image.
 *  Hover / focus (or a tap on touch screens) floats a larger preview next to the thumbnail, clamped inside the viewport. */
function Thumb({ src }: { src?: string | null }) {
  const [pop, setPop] = useState<{ x: number; y: number } | null>(null);
  const touch = useRef(false);
  const place = (el: HTMLElement) => {
    const r = el.getBoundingClientRect(); const size = Math.min(360, Math.floor(window.innerWidth * 0.8), Math.floor(window.innerHeight * 0.7)); const gap = 12;
    const x = r.right + gap + size <= window.innerWidth ? r.right + gap : Math.max(8, r.left - gap - size);
    const y = Math.min(Math.max(8, r.top + r.height / 2 - size / 2), window.innerHeight - size - 8);
    setPop({ x, y });
  };
  useEffect(() => { if (!pop) return; const off = () => setPop(null); window.addEventListener("scroll", off, true); return () => window.removeEventListener("scroll", off, true); }, [pop]);
  if (!src) return <span className={ui.thumbNone} aria-hidden="true" data-sku-thumb="none" />;
  return <span className={ui.thumbWrap} onMouseEnter={e => { if (!touch.current) place(e.currentTarget); }} onMouseLeave={() => { if (!touch.current) setPop(null); }} onFocus={e => place(e.currentTarget)} onBlur={() => setPop(null)}
    onPointerDown={e => { touch.current = e.pointerType === "touch"; }} onClick={e => { if (touch.current) { e.preventDefault(); e.stopPropagation(); if (pop) setPop(null); else place(e.currentTarget); } }} tabIndex={0} aria-label="Показать фото крупнее">
    <img src={src} alt="" loading="lazy" decoding="async" width={56} height={56} className={ui.thumb} data-sku-thumb />
    {pop && <span className={ui.thumbPop} style={{ left: pop.x, top: pop.y }} aria-hidden="true"><img src={src} alt="" decoding="async" /></span>}
  </span>;
}

type Sku = { code_1c: string; name: string; article?: string | null; supplier_id: string; supplier_name?: string; category?: string | null; unit?: string | null; unit_cost?: string | null; moq?: number; on_hand_qty?: string | null; image_url?: string | null };
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
    <PageHead priority crumbs={[{ href: "/today", label: "Сегодня" }, { label: "Товары" }]} title="Товары" sub="Каталог по данным партнёра: остаток, кратность заказа и себестоимость. Откройте товар — там продажи за 24 месяца и рекомендация." actions={<Btn variant="primary" onClick={() => router.push(supplier ? `/replenishment?supplier=${supplier}` : "/replenishment")}>К пополнению <ArrowRight size={14} aria-hidden="true" /></Btn>} />
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Найти по названию или коду 1С" aria-label="Найти по названию или коду 1С" style={control} data-v2-search />
      <div role="group" aria-label="Поставщик" style={{ display: "flex", gap: 6 }}>{SUP.map(([id, label]) => <Btn key={id || "all"} variant={supplier === id ? "black" : "secondary"} aria-pressed={supplier === id} onClick={() => setSupplier(id)}>{label}</Btn>)}</div>
      {resp ? <span style={{ marginLeft: 8, font: "var(--v2-meta)", color: "var(--v2-muted)" }}>Показано {items.length} из {resp.total}</span> : null}
    </div>
    {error && !resp ? <Unavailable title="Список товаров недоступен" detail={error.message} retry={() => setAttempt(n => n + 1)} /> : null}
    {loading && !resp ? <Loading label="Загружаю товары…" lines={6} /> : null}
    {resp && items.length === 0 ? <Empty title="Ничего не найдено">Измените запрос или выберите другого поставщика.</Empty> : null}
    {items.length ? <div className={t.table}>{items.map(s => <Link key={s.code_1c} href={`/skus/${encodeURIComponent(s.code_1c)}`} className={t.tr}>
      <div className={t.lead}><Thumb src={s.image_url} /></div>
      <div className={t.name}>
        <span className={t.label}>{s.name.replace(/\s+/g, " ")}</span>
        <span className={t.meta}>{`${s.code_1c}${s.article ? ` · арт. ${s.article}` : ""} · ${s.supplier_name ?? s.supplier_id}${s.category ? ` · ${s.category}` : ""}`}</span>
        <span className={t.meta}>{`остаток ${fmtQty(s.on_hand_qty, s.unit ?? "шт")} · кратность ${fmtQty(s.moq, "шт")}`}</span>
        {!s.unit_cost && <span className={t.warn}><Pill tone="warn">себестоимость не задана</Pill></span>}
      </div>
      <div className={t.num}><span>{fmtQty(s.on_hand_qty, s.unit ?? "шт")}</span><span className={t.meta}>остаток</span></div>
      <div className={t.num}><span>{s.unit_cost ? fmtMoney(s.unit_cost) : "—"}</span><span className={t.meta}>себестоимость</span></div>
    </Link>)}</div> : null}
    {resp && resp.total > items.length ? <p style={{ font: "var(--v2-meta)", color: "var(--v2-muted)", margin: 0 }}>Показаны первые {items.length} — уточните запрос, чтобы найти остальные.</p> : null}
  </div>;
}
