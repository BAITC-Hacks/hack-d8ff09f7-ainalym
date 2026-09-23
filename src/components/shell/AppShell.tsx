"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeftToLine, ArrowRightFromLine, Search, MoreHorizontal, CircleHelp, WifiOff } from "lucide-react";
import { ModeChip, type TruthAxes } from "@/components/labels";
import { ApiProvider, useApi, useApiSync } from "./api";
import { navigation } from "./navigation";
import { useRailCollapsed, toggleRail } from "./preferences";
import { CommandPalette } from "./CommandPalette";
import { Button } from "./Controls";
import styles from "./shell.module.css";
export type ModesResponse = TruthAxes & { mode?: "live" | "offline"; axes?: TruthAxes; labels?: Record<string, unknown> };
function Shell({ children }: { children: React.ReactNode }) {
  const [notice, setNotice] = useState("");
  const pathname = usePathname(); const router = useRouter(); const collapsed = useRailCollapsed(); const [barHidden, setBarHidden] = useState(false); const [view, setView] = useState<"commands" | "help" | "more" | null>(null);
  const { data: modes, error: modesError } = useApi<ModesResponse>("/api/modes"); const { offline, syncError, refresh } = useApiSync();
  useEffect(() => {
    let chord = 0;
    const keydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setView(v => v ? null : "commands"); return; }
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable=true]") || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "Escape") { setView(null); return; }
      if (view) return;
      if (e.key === "/") { e.preventDefault(); setView("commands"); }
      if (e.key === "?") { e.preventDefault(); setView("help"); }
      if (e.key === "[") toggleRail();
      if (Date.now() - chord < 1000) { const item = navigation.find(n => n.key === e.key); if (item) { if ("unavailable" in item) setNotice(item.unavailable); else router.push(item.href); chord = 0; return; } }
      if (e.key === "g") chord = Date.now();
      const target = ({ r: "calculation", f: "world-feed", d: "decision-primary" } as Record<string,string>)[e.key];
      if (target && pathname === "/today") { e.preventDefault(); const element = document.getElementById(target); element?.scrollIntoView({ block: "center" }); (element?.querySelector("input,select,button,a") as HTMLElement | null)?.focus({ preventScroll: true }); }
    };
    document.addEventListener("keydown", keydown); return () => document.removeEventListener("keydown", keydown);
  }, [router, view, pathname]);
  useEffect(() => {
    let previous = window.scrollY;
    const onScroll = () => { const next = window.scrollY; setBarHidden(next > previous && next > 100); previous = next; };
    window.addEventListener("scroll", onScroll, { passive: true }); return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const selected = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const modeChip = <ModeChip mode={modesError && !modes ? "unavailable" : modes?.mode} ai={modes?.axes?.ai ?? modes?.ai} />;
  return <div className={styles.shell} data-collapsed={collapsed}>
    <a className={styles.skip} href="#main">К содержимому</a>
    <aside className={styles.rail} aria-label="Навигация приложения"><Link href="/today" className={styles.brand} aria-label="Ainalym"><img src="/brand/ainalym-mark.svg" alt="" width={24} height={24} className={styles.brandMark} /><span className={styles.brandFull}>Ainalym</span></Link>
      <nav className={styles.navigation} aria-label="Основные разделы">{navigation.map((item,i) => "unavailable" in item ? <button type="button" key={item.href} className={styles.navItem} title={item.unavailable} onClick={() => setNotice(item.unavailable)}><item.icon size={18} /><span>{item.label}</span></button> : <Link href={item.href} key={item.href} className={`${styles.navItem} ${i === 5 ? styles.navSecondary : ""}`} aria-current={selected(item.href) ? "page" : undefined} title={collapsed ? item.label : undefined}><item.icon size={18} /><span>{item.label}</span></Link>)}</nav>
      <div className={styles.railFoot}><p className={styles.meta}>Пополнение склада</p><Button variant="quiet" onClick={toggleRail} aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}>{collapsed ? <ArrowRightFromLine size={18} /> : <><ArrowLeftToLine size={18} /><span>Свернуть</span><kbd>[</kbd></>}</Button></div>
    </aside>
    <div className={styles.workspace}><header className={styles.topbar} data-hidden={barHidden}><span className={styles.context}>Рабочее пространство</span><Button className={styles.search} onClick={() => setView("commands")}><Search size={16} /><span>Поиск раздела</span><kbd>⌘K</kbd></Button><div className={styles.topMode}>{modeChip}</div><Button variant="quiet" aria-label="Клавиатурные команды" onClick={() => setView("help")}><CircleHelp size={18} /></Button></header>
      <div className={styles.bands} aria-live="polite">{notice && <div className={styles.band}><span>{notice}</span><Link href="/replenishment" onClick={() => setNotice("")}>Открыть расчёт</Link><button onClick={() => setNotice("")}>Закрыть</button></div>}{offline || syncError ? <div className={styles.band}><WifiOff size={16} /><span>{offline ? "Нет связи — показываю последнее" : syncError}</span><button onClick={refresh}>Повторить</button></div> : null}{modes?.mode === "offline" && <div className={styles.band}>Офлайн-режим · записанные решения. Живой AI недоступен. <Link href="/connections">Режимы и связи</Link></div>}{modesError && <div className={styles.modeNotice}>Режимы пока недоступны — статус AI не подтверждён.</div>}</div>
      <main id="main" tabIndex={-1} className={styles.main}>{children}</main>
    </div>
    <nav className={styles.thumbnav} aria-label="Быстрая навигация">{[navigation[0], navigation[1], navigation[2], navigation[6]].map(item => <Link key={item.href} href={item.href} aria-current={selected(item.href) ? "page" : undefined}><item.icon size={20} /><span>{item.label}</span></Link>)}<button onClick={() => setView("more")}><MoreHorizontal size={20} /><span>Ещё</span></button></nav>
    {view && <CommandPalette view={view} close={() => setView(null)} />}
  </div>;
}
export function AppShell({ children }: { children: React.ReactNode }) { return <ApiProvider><Shell>{children}</Shell></ApiProvider>; }
