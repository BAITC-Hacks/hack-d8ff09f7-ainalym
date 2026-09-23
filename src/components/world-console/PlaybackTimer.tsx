"use client";
import { useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";
import { ActionStatus, apiRequest, useApiAction } from "@/components/shell";
import styles from "./world-console.module.css";

export function PlaybackTimer() {
  const [enabled, setEnabled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const action = useApiAction();
  const actionRef = useRef(action); actionRef.current = action;
  const epoch = useRef(0);
  useEffect(() => {
    const generation = ++epoch.current;
    if (!enabled) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timeout); setHidden(document.hidden);
      if (document.hidden || epoch.current !== generation) return;
      timeout = setTimeout(async () => {
        if (document.hidden || epoch.current !== generation) return;
        const result = await actionRef.current.run(() => apiRequest<{ processed: number; emitted?: unknown[] }>("/api/world/play", { method: "POST", body: JSON.stringify({ steps: 1 }) }), value => value.processed > 0 ? `✓ Обработано событий: ${value.processed}` : "Нет новых событий для обработки.");
        if (epoch.current !== generation) return;
        if (!result || result.processed === 0) setEnabled(false);
        else schedule();
      }, 20_000);
    };
    document.addEventListener("visibilitychange", schedule); schedule();
    return () => { epoch.current++; clearTimeout(timeout); document.removeEventListener("visibilitychange", schedule); };
  }, [enabled]);
  return <div className={styles.timer}><label><Timer size={16} aria-hidden="true" /><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} /><span>Воспроизводить каждые 20 с</span></label><p className={styles.meta}>{enabled ? hidden ? "Пауза: вкладка скрыта" : "Таймер включён · только пока вкладка видна" : "Таймер выключен"}</p><ActionStatus error={action.error} receipt={action.receipt} /></div>;
}
