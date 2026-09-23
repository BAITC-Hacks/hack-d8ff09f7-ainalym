"use client";
import Link from "next/link";
import { useEffect } from "react";
import { PlaybackTimer } from "./PlaybackTimer";
import { WorldControls } from "./WorldControls";
import { WorldEventList } from "./WorldEventList";
import styles from "./world-console.module.css";
export function WorldConsole() {
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || (event.target as HTMLElement).closest("input,textarea,select,[contenteditable=true],dialog")) return;
      if (event.key.toLowerCase() === "p") { event.preventDefault(); document.getElementById("world-play")?.click(); }
      if (event.key.toLowerCase() === "c") { event.preventDefault(); document.getElementById("world-compose-toggle")?.click(); }
    };
    document.addEventListener("keydown", keyboard); return () => document.removeEventListener("keydown", keyboard);
  }, []);
  return <div className={styles.page}><header className={styles.pageHead}><div><p className={styles.eyebrow}>СОБЫТИЯ → РАСЧЁТ → РЕШЕНИЕ</p><h1>Консоль мира</h1><p className={styles.subtitle}>Продажи, остатки и товары в пути. Воспроизведите событие или задайте своё и проследите работу агента.</p></div><Link href="/connections">Режимы и связи</Link></header><WorldControls /><PlaybackTimer /><WorldEventList /><p className={styles.meta}>Клавиши: P — воспроизвести · C — сочинить событие.</p></div>;
}
