"use client";
import { useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { ApiError, useApiSync } from "./api";
import styles from "./controls.module.css";
export function Button({ busy, variant = "secondary", className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; variant?: "primary" | "secondary" | "quiet" }) {
  return <button {...props} type={props.type ?? "button"} onClick={event => { if (busy || props.disabled) { event.preventDefault(); return; } props.onClick?.(event); }} className={`${styles.button} ${styles[variant]} ${className}`} aria-busy={busy || undefined} aria-disabled={busy || props.disabled || undefined}>{children}<span className={styles.busyMark} aria-hidden="true">{busy ? "…" : ""}</span></button>;
}
export function useApiAction() {
  const locked = useRef(false); const [busy, setBusy] = useState(false); const [error, setError] = useState<ApiError | null>(null); const [receipt, setReceipt] = useState(""); const { refresh, reportNetwork } = useApiSync();
  async function run<T>(action: () => Promise<T>, message: string | ((value: T) => string)): Promise<T | undefined> {
    if (locked.current) return; locked.current = true; setBusy(true); setError(null); setReceipt("");
    try { const value = await action(); setReceipt(typeof message === "function" ? message(value) : message); refresh(); return value; }
    catch (failure) { const e = failure instanceof ApiError ? failure : new ApiError(500, "unknown", "Действие не выполнено. Попробуйте ещё раз."); setError(e); if (e.status === 409) refresh(); if (e.status === 0) reportNetwork(true); }
    finally { locked.current = false; setBusy(false); }
  }
  return { busy, error, receipt, run };
}
export function ActionStatus({ error, receipt }: { error: ApiError | null; receipt: string }) { return <p className={`${styles.status} ${error ? styles.error : ""}`} role="status">{error ? (error.status === 409 ? "Версия устарела — данные обновляются. Проверьте новое предложение." : error.message) : receipt}</p>; }
export function LoadError({ message, retry }: { message?: string; retry: () => void }) { return <div className={styles.loadError}><p>{message ?? "Не удалось загрузить данные."}</p><Button onClick={retry}>Повторить</Button></div>; }
export function Skeleton({ lines = 3 }: { lines?: number }) { return <div className={styles.skeleton} aria-busy="true" aria-label="Загружаем данные">{Array.from({ length: lines }, (_, i) => <span key={i} />)}</div>; }
export function EmptyState({ children }: { children: ReactNode }) { return <p className={styles.empty}>{children}</p>; }
