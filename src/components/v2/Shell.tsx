"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { House, Package, Boxes, Wallet, Truck, Search, Bell, WifiOff, Menu, X } from "lucide-react";
import { useApi, useApiSync, type ApiError } from "@/components/shell";
import styles from "./shell.module.css";

// One shell for all five screens (MERGE-6): Сегодня · Пополнение · Товары · Деньги · Поставщик.
const NAV = [
  { href: "/v2/today", label: "Сегодня", icon: House, count: "queue" as const },
  { href: "/v2/replenishment", label: "Пополнение", icon: Package, count: "recs" as const },
  { href: "/v2/skus", label: "Товары", icon: Boxes, count: null },
  { href: "/v2/money", label: "Деньги", icon: Wallet, count: null },
  { href: "/v2/supplier/SE", label: "Поставщик", icon: Truck, count: null, match: "/v2/supplier" },
];

type Today = { queue_count: number; pulse?: { stockout_risk?: { count?: number } } };
type Snapshot<T> = { data?: T; error: ApiError | null; loading: boolean; reload: () => void };
// One /api/today request per page: the shell owns it (rail counts) and pages read the same snapshot — the route costs seconds on a full DB.
const TodayContext = createContext<Snapshot<unknown> | null>(null);
export function useTodaySnapshot<T>(): Snapshot<T> { const ctx = useContext(TodayContext); if (!ctx) throw new Error("useTodaySnapshot outside V2Shell"); return ctx as Snapshot<T>; }

export function V2Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const { offline, syncError } = useApiSync();
  const today = useApi<Today>("/api/today");
  const [open, setOpen] = useState(false);
  const search = useRef<HTMLInputElement>(null);

  // Screen tests wait for html[data-v2=ready] before taking evidence.
  useEffect(() => { document.documentElement.dataset.v2 = "ready"; return () => { delete document.documentElement.dataset.v2; }; }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); search.current?.focus(); search.current?.select(); return; }
      if (e.key === "/" && !typing && !document.querySelector("[data-v2-search]")) { e.preventDefault(); search.current?.focus(); }
      if (e.key === "Escape" && open) setOpen(false);
      if (e.key === "Escape" && document.activeElement === search.current) search.current?.blur();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => { setOpen(false); }, [pathname]);

  const counts: Record<"queue" | "recs", number | undefined> = {
    queue: today.data?.queue_count,
    recs: today.data?.pulse?.stockout_risk?.count,
  };

  return (
    <TodayContext.Provider value={today}>
    <div className={`v2 ${styles.root}`}>
      <a href="#v2-main" className={styles.skip}>К содержимому</a>
      <aside className={`${styles.rail} ${open ? styles.railOpen : ""}`} aria-label="Разделы">
        <div className={styles.brand}>
          <Link href="/v2/today" prefetch={false} className={styles.brandLink} aria-label="Ainalym — на главную">
            <span className={styles.mark} aria-hidden="true"><img src="/brand/ainalym-mark.svg" alt="" width={24} height={24} onError={e => { e.currentTarget.style.display = "none"; }} /></span>
            <span className={styles.wordmark}>Ainalym</span>
          </Link>
          <button type="button" className={styles.railClose} onClick={() => setOpen(false)} aria-label="Закрыть меню"><X size={18} /></button>
        </div>
        <nav className={styles.nav}>
          {NAV.map(item => {
            const base = item.match ?? item.href;
            const active = pathname === base || pathname.startsWith(base + "/");
            const n = item.count ? counts[item.count] : undefined;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} prefetch={false} className={`${styles.navItem} ${active ? styles.navActive : ""}`} aria-current={active ? "page" : undefined}>
                <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                <span>{item.label}</span>
                {n !== undefined && n > 0 && <span className={styles.count} aria-label={`${n} ждут решения`}>{n > 999 ? "999+" : n}</span>}
              </Link>
            );
          })}
        </nav>
        <div className={styles.railFoot}>
          <p className={styles.org}>ТОО «Электрокомплект»</p>
          <p className={styles.orgMeta}>Данные партнёра · обезличены</p>
        </div>
      </aside>
      {open && <button type="button" className={styles.scrim} aria-label="Закрыть меню" onClick={() => setOpen(false)} />}
      <div className={styles.column}>
        <header className={styles.top}>
          <button type="button" className={styles.menu} onClick={() => setOpen(true)} aria-label="Открыть меню"><Menu size={20} /></button>
          <label className={styles.search}>
            <kbd>⌘</kbd><kbd>K</kbd>
            <Search size={15} aria-hidden="true" />
            <input ref={search} type="search" placeholder="Найти товар, код или заказ" aria-label="Поиск (клавиша /)" onKeyDown={event => {
              if (event.key !== "Enter") return;
              const value = event.currentTarget.value.trim();
              if (/^\d{9}_?$/.test(value)) window.location.assign(`/v2/skus/${value.endsWith("_") ? value : value + "_"}`);
              else if (/^PO-/i.test(value)) window.location.assign(`/v2/supplier/${encodeURIComponent(value)}`);
              else if (value) window.location.assign(`/v2/skus?q=${encodeURIComponent(value)}`);
            }} />
          </label>
          <div className={styles.topRight}>
            {offline ? <span className={styles.offline} role="status"><WifiOff size={14} aria-hidden="true" />Нет связи — показываю последнее</span>
              : syncError ? <span className={styles.offline} role="status"><WifiOff size={14} aria-hidden="true" />Обновления недоступны</span>
              : <span className={styles.sync} role="status"><span className={styles.dot} aria-hidden="true" />Синхронизировано</span>}
            <span className={styles.topIcon} aria-hidden="true"><Bell size={16} /></span>
            <span className={styles.avatar} aria-label="Менеджер по закупкам">МЗ</span>
          </div>
        </header>
        <main id="v2-main" className={styles.main}>{children}</main>
      </div>
    </div>
    </TodayContext.Provider>
  );
}
