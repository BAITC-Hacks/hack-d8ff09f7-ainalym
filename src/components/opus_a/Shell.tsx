"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Home, Layers, PackageSearch, Search, ExternalLink } from "lucide-react";
import { apiRequest, useApi, useApiSync } from "@/components/shell/api";
import { qty } from "./format";

type TodayLite = { queue_count: number; pulse?: { stockout_risk?: { count: number; top?: { code_1c: string }[] } } };
type SkuHit = { code_1c: string; name: string; supplier_id: string };

function SkuSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SkuHit[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); input.current?.focus(); input.current?.select(); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      apiRequest<{ items: SkuHit[] }>(`/api/skus?q=${encodeURIComponent(term)}&limit=6`, { signal: controller.signal })
        .then(r => { setHits(r.items); setActive(0); setOpen(true); }).catch(() => {});
    }, 120);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q]);
  const go = (hit?: SkuHit) => { if (!hit) return; setOpen(false); setQ(""); router.push(`/opus_a/skus/${encodeURIComponent(hit.code_1c)}`); };
  return <div className="oa-search">
    <label>
      <Search size={16} aria-hidden />
      <span className="oa-kbd" aria-hidden>⌘</span><span className="oa-kbd" aria-hidden>K</span>
      <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Найти товар по коду 1С или названию" aria-label="Поиск товара" role="combobox" aria-expanded={open && hits.length > 0} aria-controls={listId} aria-activedescendant={open && hits[active] ? `${listId}-${active}` : undefined}
        onKeyDown={e => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive(i => Math.min(i + 1, hits.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); go(hits[active]); }
          else if (e.key === "Escape") { setOpen(false); input.current?.blur(); }
        }} onBlur={() => setTimeout(() => setOpen(false), 120)} onFocus={() => hits.length && setOpen(true)} />
    </label>
    {open && hits.length > 0 && <ul className="oa-results" id={listId} role="listbox">
      {hits.map((hit, i) => <li key={hit.code_1c} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
        <a href={`/opus_a/skus/${encodeURIComponent(hit.code_1c)}`} onMouseDown={e => { e.preventDefault(); go(hit); }}><span>{hit.name}</span><span className="muted">{hit.code_1c} · {hit.supplier_id}</span></a>
      </li>)}
    </ul>}
  </div>;
}

export function OaShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { offline, syncError } = useApiSync();
  const today = useApi<TodayLite>("/api/today");
  const decisions = today.data?.queue_count;
  const atRisk = today.data?.pulse?.stockout_risk?.count;
  const demoSku = "130200122_";
  const nav = [
    { href: "/opus_a/today", label: "Сегодня", icon: <Home size={17} aria-hidden />, count: decisions, title: "ждут вашего решения" },
    { href: "/opus_a/replenishment", label: "Пополнение", icon: <Layers size={17} aria-hidden />, count: atRisk, title: "Артикулы под риском дефицита" },
    { href: `/opus_a/skus/${demoSku}`, label: "Карточка артикула", icon: <PackageSearch size={17} aria-hidden />, match: "/opus_a/skus/" },
  ];
  return <div className="oa">
    <aside className="oa-rail" aria-label="Разделы">
      <Link href="/opus_a/today" className="oa-brand"><img src="/brand/ainalym-mark.svg" alt="" width={22} height={22} className="oa-brand-mark" />Ainalym</Link>
      <nav className="oa-nav">
        {nav.map(item => {
          const current = item.match ? path.startsWith(item.match) : path === item.href;
          return <Link key={item.href} href={item.href} aria-current={current ? "page" : undefined}>
            {item.icon}<span>{item.label}</span>
            {item.count ? <span className="oa-count" title={`${qty(item.count)} ${item.title}`}>{qty(item.count)}</span> : null}
          </Link>;
        })}
        <div className="oa-nav-sep" />
        <Link href="/today"><ExternalLink size={17} aria-hidden /><span>Основной интерфейс</span></Link>
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
  </div>;
}
