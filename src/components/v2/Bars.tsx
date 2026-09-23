"use client";
import { useEffect, useId, useRef, useState } from "react";
import { fmtNum, fmtYm } from "./ui";
import styles from "./bars.module.css";

export type Month = { ym: string; total: number; excluded: number; excludedDocs: string[]; stockout: boolean; stock: number | null; stockKnown: boolean; forecast?: boolean };

/* 24-month sales bars: regular (blue) + excluded one-off cap (purple, hatched) · stockout months hatched red with a marker · forecast months as dashed outlines. */
export function Bars({ months, unit = "шт", ariaLabel }: { months: Month[]; unit?: string; ariaLabel: string }) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setActive(null); setPinned(false); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);
  const W = 960, H = 260, padL = 44, padR = 8, padT = 12, padB = 30;
  const max = Math.max(1, ...months.map(m => m.total));
  const nice = niceMax(max);
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const slot = innerW / Math.max(1, months.length);
  const barW = Math.max(6, slot * 0.62);
  const y = (v: number) => padT + innerH - (v / nice) * innerH;
  const ticks = [0, nice / 2, nice];
  const shown = active !== null ? months[active] : null;
  const move = (delta: number) => setActive(a => { const next = Math.min(months.length - 1, Math.max(0, (a ?? 0) + delta)); return next; });
  return <div ref={root} className={styles.wrap}>
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={ariaLabel}>
      <defs>
        <pattern id={`${id}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--v2-bar-excluded)" opacity=".35" /><line x1="0" y1="0" x2="0" y2="6" stroke="var(--v2-bar-excluded)" strokeWidth="2" /></pattern>
        <pattern id={`${id}-so`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="6" height="6" fill="var(--v2-bad-bg)" /><line x1="0" y1="0" x2="0" y2="6" stroke="var(--v2-stockout)" strokeWidth="1.5" /></pattern>
      </defs>
      {ticks.map(t => <g key={t}><line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--v2-line)" strokeDasharray={t === 0 ? undefined : "2 4"} /><text x={padL - 8} y={y(t) + 4} textAnchor="end" className={styles.tick}>{fmtNum(t)}</text></g>)}
      {months.map((m, i) => {
        const x = padL + i * slot + (slot - barW) / 2;
        const regular = Math.max(0, m.total - m.excluded);
        const isActive = active === i;
        return <g key={m.ym} className={styles.slot} tabIndex={0} role="button" aria-label={`${fmtYm(m.ym)}: ${fmtNum(m.total)} ${unit}${m.excluded ? `, исключено ${fmtNum(m.excluded)}` : ""}${m.stockout ? ", дефицит" : ""}${m.forecast ? ", прогноз" : ""}`}
          onMouseEnter={() => { if (!pinned) setActive(i); }} onMouseLeave={() => { if (!pinned) setActive(null); }} onFocus={() => setActive(i)} onBlur={() => { if (!pinned) setActive(null); }}
          onClick={() => { setActive(i); setPinned(p => !(p && active === i)); }}
          onKeyDown={e => { if (e.key === "ArrowRight") { e.preventDefault(); move(1); focusSlot(root.current, i + 1); } if (e.key === "ArrowLeft") { e.preventDefault(); move(-1); focusSlot(root.current, i - 1); } if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPinned(p => !p); } }}>
          <rect x={padL + i * slot} y={padT} width={slot} height={innerH} fill={isActive ? "rgba(20,20,19,.05)" : "transparent"} />
          {m.forecast
            ? <rect x={x} y={y(m.total)} width={barW} height={Math.max(0, y(0) - y(m.total))} rx="3" fill="none" stroke="var(--v2-bar-forecast)" strokeDasharray="4 3" strokeWidth="1.5" />
            : <>
              <rect x={x} y={y(regular)} width={barW} height={Math.max(0, y(0) - y(regular))} rx="3" fill={m.stockout ? `url(#${id}-so)` : isActive ? "var(--v2-bar)" : "var(--v2-bar)"} stroke={m.stockout ? "var(--v2-stockout)" : "none"} strokeWidth="1" opacity={m.stockout ? 1 : isActive ? 1 : .85} />
              {m.excluded > 0 && <rect x={x} y={y(m.total)} width={barW} height={Math.max(2, y(regular) - y(m.total) - 2)} rx="3" fill={`url(#${id}-hatch)`} stroke="var(--v2-bar-excluded)" strokeWidth="1" />}
            </>}
          {m.stockout && <circle cx={x + barW / 2} cy={H - padB + 20} r="3.5" fill="var(--v2-stockout)" />}
          {(i % 3 === 0 || months.length <= 12) && <text x={x + barW / 2} y={H - padB + 12} textAnchor="middle" className={styles.tick}>{fmtYm(m.ym)}</text>}
        </g>;
      })}
    </svg>
    <div className={styles.legend} aria-hidden="true">
      <span><i className={styles.swBar} />Продажи за месяц</span>
      <span><i className={styles.swEx} />Исключённый разовый документ</span>
      <span><i className={styles.swSo} />Месяц с дефицитом (нет остатка)</span>
      <span><i className={styles.swFc} />Прогноз</span>
    </div>
    <div className={styles.tip} role="status" aria-live="polite">
      {shown ? <>
        <strong>{fmtYm(shown.ym)}{shown.forecast ? " · прогноз" : ""}</strong>
        <span>{shown.forecast ? "Ожидаемый спрос" : "Продажи по файлу"}<b>{fmtNum(shown.total, 1)} {unit}</b></span>
        {!shown.forecast && <span>Регулярный спрос<b>{fmtNum(Math.max(0, shown.total - shown.excluded), 1)} {unit}</b></span>}
        {shown.excluded > 0 && <span>Исключено · {shown.excludedDocs.join(", ")}<b>−{fmtNum(shown.excluded)} {unit}</b></span>}
        {!shown.forecast && <span>Остаток на начало месяца<b>{shown.stockKnown && shown.stock !== null ? `${fmtNum(shown.stock)} ${unit}` : "не задан"}</b></span>}
        {shown.stockout && <span className={styles.tipBad}>Дефицит — продажи цензурированы, месяц не занижает прогноз</span>}
      </> : <span className={styles.tipHint}>Наведите или выберите месяц — ← → по месяцам, Enter закрепить, Esc закрыть</span>}
    </div>
  </div>;
}
function focusSlot(root: HTMLDivElement | null, index: number) { root?.querySelectorAll<SVGGElement>("g[tabindex]")[index]?.focus(); }
function niceMax(v: number) { const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10; return step * p; }
