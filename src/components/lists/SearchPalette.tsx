"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { apiRequest, ApiError, Button, EmptyState, LoadError } from "@/components/shell";
import { localHref } from "@/components/assistant/types";
import styles from "./overlays.module.css";

type SearchResponse = { query: string; items: { id: string; kind: string; title: string; meta?: string; href: string }[] };
export function SearchResults({ query, onNavigate }: { query: string; onNavigate?: () => void }) {
  const [snapshot, setSnapshot] = useState<SearchResponse>();
  const [error, setError] = useState<ApiError>();
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const trimmed = query.trim();
  useEffect(() => {
    const controller = new AbortController();
    if (!trimmed) { setLoading(false); setError(undefined); return; }
    setLoading(true); setError(undefined);
    const timeout = setTimeout(async () => {
      try { const response = await apiRequest<SearchResponse>(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal }); if (!controller.signal.aborted) setSnapshot(response); }
      catch (failure) { if (!controller.signal.aborted) setError(failure instanceof ApiError ? failure : new ApiError(500, "unknown", "Поиск не выполнен.")); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 150);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [trimmed, attempt]);
  const current = snapshot?.query === trimmed ? snapshot : undefined;
  return <div className={styles.searchResults} aria-busy={loading}>
    <p className={styles.searchStatus} role="status">{loading ? "Ищем…" : current ? `Показано: ${current.items.length}` : ""}</p>
    {!trimmed ? <EmptyState>Введите код, название товара, поставщика или номер заказа.</EmptyState> : error ? <LoadError message={error.message} retry={() => setAttempt(value => value + 1)} /> : current && <>{current.items.length ? <ul className={styles.items}>{current.items.map(item => <li key={`${item.kind}:${item.id}`}><Link href={localHref(item.href) ?? "/today"} onClick={onNavigate}><strong>{item.title}</strong><span>{item.meta}</span></Link></li>)}</ul> : <EmptyState>По этому запросу ничего не найдено.</EmptyState>}</>}
  </div>;
}
export function SearchPalette() {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null); const trigger = useRef<HTMLSpanElement>(null);
  const [query, setQuery] = useState("");
  const close = () => { dialog.current?.close(); trigger.current?.querySelector<HTMLButtonElement>("button")?.focus(); };
  return <><span ref={trigger}><Button onClick={() => dialog.current?.showModal()}><Search size={16} />Поиск товаров и заказов</Button></span><dialog ref={dialog} className={styles.dialog} onCancel={event => { event.preventDefault(); close(); }} aria-labelledby={id}><header className={styles.head}><h2 id={id}>Поиск</h2><Button aria-label="Закрыть поиск" onClick={close}><X size={18} /></Button></header><label className={styles.searchField}><Search size={18} /><input autoFocus type="search" value={query} maxLength={120} onChange={event => setQuery(event.target.value)} aria-label="Найти товар, заказ или расчёт" placeholder="Код, название или номер…" /></label><SearchResults query={query} onNavigate={close} /></dialog></>;
}
