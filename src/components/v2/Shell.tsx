"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { House, Package, Boxes, Wallet, Search, Bell, WifiOff, Menu, X } from "lucide-react";
import { useApi, useApiSync } from "@/components/shell/api";
import styles from "./shell.module.css";

const NAV = [
  { href: "/v2/today", label: "Сегодня", icon: House, count: "queue" as const },
  { href: "/v2/replenishment", label: "Пополнение", icon: Package, count: "recs" as const },
  { href: "/v2/skus", label: "Товары", icon: Boxes, count: null },
  { href: "/v2/money", label: "Деньги", icon: Wallet, count: null },
];

type Today = { queue_count: number; pulse?: { stockout_risk?: { count?: number } } };

export function V2Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { offline, syncError } = useApiSync();
  const today = useApi<Today>("/api/today");
  const [open, setOpen] = useState(false);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); search.current?.focus(); search.current?.select(); return; }
      if (e.key === "/" && !typing && !document.querySelector("[data-v2-search]")) { e.preventDefault(); search.current?.focus(); }
      if (e.key === "Escape" && open) setOpen(false);
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
    <div className={`v2 ${styles.root}`}>
      <a href="#v2-main" className={styles.skip}>К содержимому</a>
      <aside className={`${styles.rail} ${open ? styles.railOpen : ""}`} aria-label="Разделы">
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true" />
          <span className={styles.wordmark}>Айналым</span>
          <button type="button" className={styles.railClose} onClick={() => setOpen(false)} aria-label="Закрыть меню"><X size={18} /></button>
        </div>
        <nav className={styles.nav}>
          {NAV.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const n = item.count ? counts[item.count] : undefined;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`${styles.navItem} ${active ? styles.navActive : ""}`} aria-current={active ? "page" : undefined}>
                <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                <span>{item.label}</span>
                {n !== undefined && n > 0 && <span className={styles.count}>{n > 999 ? "999+" : n}</span>}
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
            <input ref={search} type="search" placeholder="Найти товар, код 1С или заказ" aria-label="Поиск" />
          </label>
          <div className={styles.topRight}>
            {(offline || syncError) && <span className={styles.offline} role="status"><WifiOff size={14} aria-hidden="true" />{offline ? "Нет связи — показываю последнее" : "Обновления недоступны"}</span>}
            <span className={styles.topIcon} aria-hidden="true"><Bell size={16} /></span>
            <span className={styles.avatar} aria-label="Менеджер по закупкам">МЗ</span>
          </div>
        </header>
        <main id="v2-main" className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
