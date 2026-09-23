"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { House, LayoutGrid, Package, Search } from "lucide-react";
import { apiRequest, useApi, useApiSync } from "@/components/shell/api";
import { Kbd } from "./ui";
import { int } from "./format";
import type { SkuList, TodayResponse, Sku } from "./types";
import s from "./shell.module.css";

function SkuSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Sku[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.current?.focus(); input.current?.select(); setOpen(true); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setItems([]); setStatus("idle"); return; }
    const controller = new AbortController(); setStatus("loading");
    const timer = setTimeout(async () => {
      try { const res = await apiRequest<SkuList>(`/api/skus?q=${encodeURIComponent(term)}&limit=8`, { signal: controller.signal }); setItems(res.items); setActive(0); setStatus("idle"); }
      catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("error"); }
    }, 120);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q]);
  const go = (code: string) => { setOpen(false); setQ(""); input.current?.blur(); router.push(`/opus_b/skus/${encodeURIComponent(code)}`); };
  const showList = open && q.trim().length >= 2;
  return <div className={s.search}>
    <label className={s.searchBox}>
      <Search size={16} aria-hidden />
      <input ref={input} value={q} placeholder="Найти товар: код 1С, артикул или название" role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={showList && items[active] ? `${listId}-${active}` : undefined}
        onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={e => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive(i => Math.min(i + 1, Math.max(items.length - 1, 0))); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
          else if (e.key === "Enter" && items[active]) { e.preventDefault(); go(items[active].code_1c); }
          else if (e.key === "Escape") { setOpen(false); if (!showList) { setQ(""); input.current?.blur(); } }
        }} />
      <Kbd>⌘</Kbd><Kbd>K</Kbd>
    </label>
    {showList && <ul id={listId} role="listbox" className={s.list} aria-label="Товары">
      {status === "error" && <li className={s.listNote}>Поиск недоступен — попробуйте ещё раз</li>}
      {status !== "error" && items.length === 0 && <li className={s.listNote}>{status === "loading" ? "Ищу…" : "Ничего не найдено"}</li>}
      {items.map((item, i) => <li key={item.code_1c} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={s.option} onMouseDown={e => { e.preventDefault(); go(item.code_1c); }} onMouseEnter={() => setActive(i)}>
        <span className={s.optName}>{item.name}</span>
        <span className={s.optHint}>{item.supplier_id}</span>
        <span className={s.optMeta}>{item.code_1c}{item.article ? ` · ${item.article}` : ""}{item.on_hand_qty ? ` · остаток ${int(item.on_hand_qty)}` : ""}</span>
      </li>)}
    </ul>}
  </div>;
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const { offline, syncError } = useApiSync();
  const today = useApi<TodayResponse>("/api/today");
  const topCode = today.data?.pulse.stockout_risk.top[0]?.code_1c;
  const nav = [
    { href: "/opus_b/today", label: "Сегодня", Icon: House, badge: today.data?.queue_count, match: "/opus_b/today" },
    { href: "/opus_b/replenishment", label: "Пополнение", Icon: LayoutGrid, badge: today.data?.pulse.stockout_risk.count, match: "/opus_b/replenishment" },
    { href: topCode ? `/opus_b/skus/${encodeURIComponent(topCode)}` : "/opus_b/replenishment", label: "Товар", Icon: Package, badge: undefined, match: "/opus_b/skus" },
  ];
  const links = (mobile: boolean) => nav.map(({ href, label, Icon, badge, match }) => {
    const current = pathname.startsWith(match);
    return <li key={label}><Link href={href} className={`${s.link} ${current ? s.active : ""}`} aria-current={current ? "page" : undefined}>
      <Icon size={17} aria-hidden />{label}{!mobile && badge !== undefined && badge > 0 && <span className={s.badge} aria-label={`${badge}`}>{int(badge)}</span>}
    </Link></li>;
  });
  return <div data-ob className={s.frame}>
    <a href="#ob-main" className={s.skip}>К содержимому</a>
    <aside className={s.rail} aria-label="Разделы">
      <Link href="/opus_b/today" className={s.brand}><span className={s.brandDot} aria-hidden />Айналым</Link>
      <nav aria-label="Основное"><ul className={s.nav}>{links(false)}</ul></nav>
      <div className={s.railFoot}>
        <span className={s.sync}><span className={`${s.dot} ${offline || syncError ? s.dotOff : ""}`} aria-hidden />{offline ? "Нет связи — показываю последнее" : syncError ? "Обновления на паузе" : "Синхронизировано"}</span>
        <span>Агенты · данные партнёра</span>
      </div>
    </aside>
    <div className={s.col}>
      <header className={s.top}>
        <SkuSearch />
        <nav aria-label="Разделы на телефоне" className={s.mobileNav}><ul className={s.mobileList}>{links(true)}</ul></nav>
        <div className={s.topRight}><span>ТОО «Электрокомплект»</span><span className={s.avatar} aria-hidden>ЗК</span></div>
      </header>
      <main id="ob-main" className={s.main} tabIndex={-1}>{children}</main>
    </div>
  </div>;
}
