"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { navigation } from "./navigation";
import { Button } from "./Controls";
import styles from "./shell.module.css";
export function CommandPalette({ view, close }: { view: "commands" | "help" | "more" | null; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null); const input = useRef<HTMLInputElement>(null); const [query, setQuery] = useState(""); const [active, setActive] = useState(0); const router = useRouter();
  const items = [...navigation, { href: "/today#calculation", label: "Запустить расчёт", key: "", icon: Search }].filter(item => item.label.toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru")));
  useEffect(() => { if (!view) return; const previous = document.activeElement as HTMLElement | null; const node = dialog.current; node?.showModal(); input.current?.focus(); return () => { node?.close(); previous?.focus({ preventScroll: true }); }; }, [view]);
  return <dialog ref={dialog} className={styles.dialog} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }} aria-label={view === "help" ? "Клавиатурные команды" : "Разделы и действия"}>
    <div className={styles.dialogHead}><h2>{view === "help" ? "Клавиатурные команды" : "Разделы и действия"}</h2><Button aria-label="Закрыть" variant="quiet" onClick={close}><X size={18} /></Button></div>
    {view === "commands" && <div className={styles.paletteSearch}><Search size={20} /><input ref={input} aria-label="Найти раздел или действие" placeholder="Куда перейти?" value={query} onChange={e => { setQuery(e.target.value); setActive(0); }} onKeyDown={e => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setActive(n => (n + (e.key === "ArrowDown" ? 1 : -1) + items.length) % Math.max(items.length, 1)); } if (e.key === "Enter" && items[active] && !("unavailable" in items[active])) { e.preventDefault(); router.push(items[active].href); close(); } }} aria-controls="command-results" aria-activedescendant={items.length ? `command-${active}` : undefined} role="combobox" aria-expanded="true" aria-autocomplete="list" /></div>}
    <div className={styles.dialogBody} id="command-results" role={view === "commands" ? "listbox" : undefined}>
      {view === "help" ? <><p className={styles.meta}>Команды не перехватывают ввод в полях.</p>{[["⌘K / Ctrl K / /", "Разделы и действия"], ["?", "Эта карта"], ["[", "Свернуть меню"], ["Esc", "Закрыть окно"], ...navigation.map(n => [`g ${n.key}`, n.label]), ["r", "Запустить расчёт: перейти к форме"], ["f", "Лента событий"], ["d", "Первое решение"]].map(([key,label]) => <div className={styles.shortcut} key={key}><span>{label}</span><kbd>{key}</kbd></div>)}</> : items.length ? items.map((item,index) => "unavailable" in item ? <div id={`command-${index}`} key={item.href} role={view === "commands" ? "option" : undefined} aria-disabled="true" className={styles.command}><item.icon size={18} /><span>{item.label}<small className={styles.meta}> — {item.unavailable}</small></span></div> : <Link id={`command-${index}`} role={view === "commands" ? "option" : undefined} aria-selected={view === "commands" ? index === active : undefined} data-active={index === active} key={item.href} href={item.href} className={styles.command} onClick={close}><item.icon size={18} /><span>{item.label}</span>{item.key && <kbd>g {item.key}</kbd>}</Link>) : <p className={styles.empty}>Ничего не нашли по «{query}».</p>}
    </div><div className={styles.dialogFoot}><span>↑ ↓ выбрать</span><span>Enter открыть</span><span>Esc закрыть</span></div>
  </dialog>;
}
