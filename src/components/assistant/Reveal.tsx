"use client";
import styles from "./reveal.module.css";

/** Progressive text reveal: each word fades in ≈ 32 ms after the previous one (CSS only — no timers, no layout shift). */
export const WORD_MS = 32;
const MAX_MS = 2400;

export function revealMs(text: string): number {
  return Math.min(MAX_MS, text.trim().split(/\s+/).filter(Boolean).length * WORD_MS);
}

export function Reveal({ text, animate = true }: { text: string; animate?: boolean }) {
  if (!animate) return <>{text}</>;
  let index = 0;
  return <>{text.split(/(\s+)/).map((part, key) => !part || /^\s+$/.test(part)
    ? part
    : <span key={key} className={styles.word} style={{ animationDelay: `${Math.min(MAX_MS, index++ * WORD_MS)}ms` }}>{part}</span>)}</>;
}

/** 1–2 next-step chips under an answer; they appear after the text reveal and send their text as the next user turn. */
export function FollowUps({ items, delayMs = 0, disabled = false, onPick }: { items: string[]; delayMs?: number; disabled?: boolean; onPick: (text: string) => void }) {
  if (!items.length) return null;
  return <div className={styles.followups} style={{ animationDelay: `${delayMs}ms` }} aria-label="Следующие шаги">
    {items.map(item => <button key={item} type="button" className={styles.followup} disabled={disabled} onClick={() => onPick(item)}>{item}</button>)}
  </div>;
}
