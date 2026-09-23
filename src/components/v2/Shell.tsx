"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { useApi, useApiSync } from "@/components/shell";
import styles from "./shell.module.css";

const NAV: { href: string; label: string; match: string; countKey?: "queue" }[] = [
  { href: "/v2/today", label: "Сегодня", match: "/v2/today" },
  { href: "/v2/replenishment", label: "Пополнение", match: "/v2/replenishment", countKey: "queue" },
  { href: "/v2/skus/130300027_", label: "Позиции", match: "/v2/skus" },
  { href: "/v2/money", label: "Деньги", match: "/v2/money" },
];

export function V2Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const search = useRef<HTMLInputElement>(null);
  const { offline, syncError } = useApiSync();
  const queue = useApi<{ items?: unknown[] }>("/api/queue");
  const health = useApi<{ ai_provider?: string; mode?: string }>("/api/health");
  const queueCount = queue.data?.items?.length ?? 0;
  useEffect(() => { document.documentElement.dataset.v2 = "ready"; return () => { delete document.documentElement.dataset.v2; }; }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (!typing && event.key === "/") { event.preventDefault(); search.current?.focus(); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); search.current?.focus(); }
      if (event.key === "Escape" && document.activeElement === search.current) search.current?.blur();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const ai = health.data?.ai_provider;
  const aiLabel = ai === "rules" ? "Правила без LLM" : ai === "offline" ? "Воспроизведение · записанное решение" : ai === "jev" || ai === "openai" ? "Живой AI" : health.error ? "Провайдер недоступен" : "";
  return <div className={styles.frame}>
    <aside className={styles.side} aria-label="Разделы">
      <Link href="/v2/today" prefetch={false} className={styles.brand} aria-label="Ainalym — на главную"><img src="/brand/ainalym-mark.svg" alt="" width={20} height={20} className={styles.mark} />Ainalym</Link>
      <nav className={styles.nav}>
        {NAV.map(item => {
          const active = pathname.startsWith(item.match);
          const count = item.countKey === "queue" ? queueCount : 0;
          return <Link key={item.href} href={item.href} prefetch={false} className={`${styles.navItem} ${active ? styles.navActive : ""}`} aria-current={active ? "page" : undefined}>
            <span>{item.label}</span>{count > 0 && <span className={styles.count} aria-label={`${count} ждут решения`}>{count}</span>}
          </Link>;
        })}
      </nav>
      <div className={styles.sideFoot}>
        <p className={styles.truth}>Данные партнёра · обезличены</p>
        {aiLabel && <p className={styles.truth}>{aiLabel}</p>}
      </div>
    </aside>
    <div className={styles.body}>
      <header className={styles.top}>
        <label className={styles.search}>
          <kbd aria-hidden="true">⌘K</kbd>
          <input ref={search} type="search" placeholder="Найти позицию, заказ, поставщика…" aria-label="Поиск (клавиша /)" onKeyDown={event => {
            if (event.key !== "Enter") return;
            const value = event.currentTarget.value.trim();
            if (/^\d{9}_?$/.test(value)) window.location.assign(`/v2/skus/${value.endsWith("_") ? value : value + "_"}`);
            else if (/^PO-/i.test(value)) window.location.assign(`/v2/supplier/${value}`);
          }} />
        </label>
        <div className={styles.topRight}>
          {offline ? <span className={`${styles.sync} ${styles.syncBad}`} role="status">Нет связи — показываю последнее</span>
            : syncError ? <span className={`${styles.sync} ${styles.syncWarn}`} role="status">{syncError}</span>
            : <span className={styles.sync} role="status"><span className={styles.dot} aria-hidden="true" />Синхронизировано</span>}
          <span className={styles.avatar} aria-label="Менеджер закупок">МЗ</span>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  </div>;
}
