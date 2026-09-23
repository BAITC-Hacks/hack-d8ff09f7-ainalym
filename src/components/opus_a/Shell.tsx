"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Home, Layers, PackageSearch, Search, ExternalLink } from "lucide-react";
import { apiRequest, useApi, useApiSync } from "@/components/shell/api";
import { qty } from "./format";
import { skuHref } from "./navigation";
import { ProductImage } from "./ui";

import type { TodayResp } from "./Today";
const TodayContext = createContext<ReturnType<typeof useApi<TodayResp>> | null>(null);
export function useTodaySnapshot() {
  const snapshot = useContext(TodayContext);
  if (!snapshot) throw new Error("Today snapshot requires the Opus A shell");
  return snapshot;
}
type SkuHit = { code_1c: string; name: string; supplier_id: string; article?: string | null; image_url?: string | null };

function SkuSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SkuHit[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [attempt, setAttempt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); input.current?.focus(); input.current?.select(); setOpen(true); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      apiRequest<{ items: SkuHit[] }>(`/api/skus?q=${encodeURIComponent(term)}&limit=6`, { signal: controller.signal })
        .then(r => { if (!controller.signal.aborted) { setHits(r.items); setActive(0); setStatus("ready"); } })
        .catch(() => { if (!controller.signal.aborted) { setHits([]); setStatus("error"); } });
    }, 120);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q, attempt]);
  const go = (hit?: SkuHit) => { if (!hit) return; setOpen(false); setQ(""); setHits([]); setStatus("idle"); router.push(skuHref(hit.code_1c)); };
  return <div className="oa-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label>
      <Search size={16} aria-hidden />
      <span className="oa-kbd" aria-hidden>⌘</span><span className="oa-kbd" aria-hidden>K</span>
      <input ref={input} value={q} autoComplete="off" onChange={e => { setQ(e.target.value); setHits([]); setActive(0); setStatus(e.target.value.trim().length < 2 ? "idle" : "loading"); setOpen(true); }} placeholder="Код 1С, артикул или название" aria-label="Поиск товара" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open ? listId : undefined} aria-activedescendant={open && hits[active] ? `${listId}-${active}` : undefined}
        onKeyDown={e => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, Math.max(0, hits.length - 1))); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
          else if (e.key === "Enter" && open) { e.preventDefault(); go(hits[active]); }
          else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
        }} onFocus={() => setOpen(true)} />
    </label>
    {open && <div className="oa-search-panel">
      <ul className="oa-results" id={listId} role="listbox" aria-label="Найденные товары">
        {hits.map((hit, i) => <li key={hit.code_1c} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
          <Link href={skuHref(hit.code_1c)} onClick={() => { setOpen(false); setQ(""); setHits([]); setStatus("idle"); }} tabIndex={-1}>
            <ProductImage src={hit.image_url} /><span><span className="oa-search-name">{hit.name}</span><span className="muted">{hit.code_1c}{hit.article ? ` · ${hit.article}` : ""} · {hit.supplier_id}</span></span>
          </Link>
        </li>)}
      </ul>
      <div className="oa-search-status" role="status">{status === "loading" ? "Ищу товары…" : status === "error" ? <>Поиск недоступен. <button className="oa-link" onClick={() => { setStatus("loading"); setAttempt(n => n + 1); }}>Повторить</button></> : q.trim().length < 2 ? "Введите хотя бы 2 символа" : hits.length === 0 ? `По запросу «${q}» ничего не найдено. Проверьте код или название.` : `${hits.length} результатов · ↑ ↓ выбрать · Enter открыть`}</div>
    </div>}
  </div>;
}

export function OaShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { offline, syncError } = useApiSync();
  const today = useApi<TodayResp>("/api/today");
  const decisions = today.data?.queue_count;
  const atRisk = today.data?.pulse?.stockout_risk?.count;
  const demoSku = "130200122_";
  const nav = [
    { href: "/opus_a/today", label: "Сегодня", icon: <Home size={17} aria-hidden />, count: decisions, title: "ждут вашего решения" },
    { href: "/opus_a/replenishment", label: "Пополнение", icon: <Layers size={17} aria-hidden />, count: atRisk, title: "SKU под риском дефицита" },
    { href: `/opus_a/skus/${demoSku}`, label: "Товар", icon: <PackageSearch size={17} aria-hidden />, match: "/opus_a/skus/" },
  ];
  return <TodayContext.Provider value={today}><div className="oa" lang="ru">
    <a className="oa-skip" href="#main">К содержимому</a>
    <aside className="oa-rail" aria-label="Разделы">
      <Link href="/opus_a/today" className="oa-brand"><Image className="oa-brand-mark" src="/brand/ainalym-mark.svg" width={24} height={24} alt="" />Ainalym</Link>
      <nav className="oa-nav">
        {nav.map(item => {
          const current = item.match ? path.startsWith(item.match) : path === item.href;
          return <Link key={item.href} href={item.href} aria-current={current ? "page" : undefined}>
            {item.icon}<span>{item.label}</span>
            {item.count ? <span className="oa-count" title={`${qty(item.count)} ${item.title}`}>{qty(item.count)}</span> : null}
          </Link>;
        })}
        <div className="oa-nav-sep" />
        <Link href="/today" className="oa-main-interface"><ExternalLink size={17} aria-hidden /><span>Основной интерфейс</span></Link>
      </nav>
      <div className="oa-rail-foot">
        <div className="oa-sync" data-state={offline || syncError ? "offline" : "live"} role="status"><i aria-hidden />{offline ? "Нет связи — показываю последнее" : syncError ? "Обновления временно недоступны" : "Синхронизация включена"}</div>
        <span>Данные партнёра · обезличены</span>
      </div>
    </aside>
    <div className="oa-main">
      <header className="oa-top"><SkuSearch /></header>
      {children}
    </div>
  </div></TodayContext.Provider>;
}
