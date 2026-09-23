"use client";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, ExternalLink, Sparkles, X } from "lucide-react";
import { ResultCard } from "./ResultCard";
import { contextTitle, detectBase, encodeContext, pageContext, parseContext, suggestedPrompts, type AssistantContext } from "./context";
import type { AssistantResult } from "./types";
import styles from "./dock.module.css";

type Entry = { id: string; question: string; response: AssistantResult; at: number };
const THREAD_KEY = "ainalym.assistant.thread.v1";
const THREAD_TTL = 12 * 60 * 60 * 1000;
const CANNOT_ANSWER = "Не могу ответить по этим данным. Попробуйте открыть карточку товара.";

function loadThread(): Entry[] {
  try {
    const raw = localStorage.getItem(THREAD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { at?: number; entries?: Entry[] };
    if (!parsed.at || Date.now() - parsed.at > THREAD_TTL || !Array.isArray(parsed.entries)) return [];
    return parsed.entries.slice(-40);
  } catch { return []; }
}
function saveThread(entries: Entry[]) { try { localStorage.setItem(THREAD_KEY, JSON.stringify({ at: Date.now(), entries: entries.slice(-40) })); } catch { /* storage may be unavailable */ } }
function readContext(base: string, pathname: string, page: boolean): AssistantContext {
  if (page) { const fromUrl = parseContext(new URLSearchParams(window.location.search).get("ctx")); if (fromUrl) return fromUrl; }
  return pageContext(pathname, base, document.querySelector("[data-ainalym-context]")?.getAttribute("data-ainalym-context"));
}

/**
 * Linear-style assistant side sheet. Shell-agnostic: mount once; `base` is the route prefix ("" when the shell is served at /,
 * detected from the URL when omitted). Opens from the «ИИ-ассистент» nav item or ⌘J / Ctrl+J, closes with Esc.
 * `mode="page"` renders the same conversation as a page (popup window).
 */
export function AssistantDock({ base: baseProp, mode = "sheet" }: { base?: string; mode?: "sheet" | "page" }) {
  const pathname = usePathname() ?? "";
  const base = baseProp ?? detectBase(pathname);
  const page = mode === "page";
  const id = useId();
  const [open, setOpen] = useState(page);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [ctx, setCtx] = useState<AssistantContext>({ route: "other", entity: {} });
  const [navHost, setNavHost] = useState<Element | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const active = page || pathname !== `${base}/assistant`;

  useEffect(() => {
    setEntries(loadThread());
    const sync = (event: StorageEvent) => { if (event.key === THREAD_KEY) setEntries(loadThread()); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const refreshContext = useCallback(() => setCtx(readContext(base, pathname, page)), [base, pathname, page]);
  useEffect(() => {
    refreshContext();
    window.addEventListener("ainalym:context", refreshContext);
    return () => window.removeEventListener("ainalym:context", refreshContext);
  }, [refreshContext]);
  useEffect(() => { if (!page) setNavHost(document.querySelector('aside[aria-label="Разделы"] nav')); }, [page, pathname]);
  useEffect(() => {
    if (!page) return;
    document.documentElement.dataset.assistantPage = "1";
    return () => { delete document.documentElement.dataset.assistantPage; };
  }, [page]);
  useEffect(() => { body.current?.scrollTo({ top: body.current.scrollHeight }); }, [entries, busy]);

  const show = useCallback(() => {
    opener.current = document.activeElement as HTMLElement | null;
    setCtx(readContext(base, pathname, page));
    setOpen(true);
    requestAnimationFrame(() => input.current?.focus());
  }, [base, pathname, page]);
  const hide = useCallback(() => { setOpen(false); opener.current?.focus?.(); }, []);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "j") {
        event.preventDefault();
        if (page) input.current?.focus(); else if (open) hide(); else show();
        return;
      }
      if (event.key === "Escape" && open && !page) { event.preventDefault(); hide(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, open, page, show, hide]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) { input.current?.focus(); return; }
    setBusy(true);
    setText("");
    const context = readContext(base, pathname, page);
    setCtx(context);
    let response: AssistantResult;
    try {
      const res = await fetch("/api/assistant/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: q, context, base }) });
      response = res.ok ? await res.json() as AssistantResult : { ok: false, reply_ru: CANNOT_ANSWER };
    } catch { response = { ok: false, reply_ru: CANNOT_ANSWER }; }
    setEntries(previous => { const next = [...previous, { id: crypto.randomUUID(), question: q, response, at: Date.now() }]; saveThread(next); return next; });
    setBusy(false);
    input.current?.focus();
  }
  function openSeparately() {
    window.open(`${base}/assistant?ctx=${encodeContext(ctx)}`, "ainalym-assistant", "popup=yes,width=480,height=760");
    hide();
  }
  function clear() { setEntries([]); saveThread([]); input.current?.focus(); }

  if (!active) return null;
  const title = contextTitle(ctx);
  const chips = suggestedPrompts(ctx);
  const trigger = navHost && !page ? createPortal(
    <button type="button" className={styles.navTrigger} aria-expanded={open} aria-controls={`${id}-dock`} aria-keyshortcuts="Meta+J Control+J" onClick={() => open ? hide() : show()}>
      <span className={styles.navLabel}><Sparkles size={15} aria-hidden="true" />Спросить помощника</span><kbd aria-hidden="true">⌘J</kbd>
    </button>, navHost) : null;
  return <>
    {trigger}
    {open && <aside id={`${id}-dock`} role="dialog" aria-label="Помощник" className={`${styles.sheet} ${page ? styles.page : ""}`}>
      <header className={styles.head}>
        <Sparkles size={16} aria-hidden="true" className={styles.spark} />
        <h2 className={styles.title}>Помощник</h2>
        <span className={styles.scope} title={title}>{title}</span>
        <div className={styles.headActions}>
          {!page && <button type="button" className={styles.iconBtn} onClick={openSeparately}><ExternalLink size={14} aria-hidden="true" />Открыть отдельно</button>}
          <button type="button" className={styles.iconBtn} aria-label={page ? "Закрыть окно" : "Закрыть (Esc)"} onClick={() => page ? window.close() : hide()}><X size={16} aria-hidden="true" /></button>
        </div>
      </header>
      <div className={styles.body} ref={body} aria-live="polite">
        {entries.length === 0 && <p className={styles.intro}>Отвечаю по данным этой страницы — {title}. Выберите вопрос ниже или напишите свой.</p>}
        {entries.map(entry => <ResultCard key={entry.id} title={entry.question} response={entry.response} plain base={base} />)}
        {busy && <p className={styles.status} role="status">Смотрю данные…</p>}
      </div>
      <div className={styles.foot}>
        <div className={styles.chips} aria-label="Подсказки">{chips.map(chip => <button key={chip.id} type="button" className={styles.chip} disabled={busy} onClick={() => void ask(chip.text)}>{chip.text}</button>)}</div>
        <form className={styles.composer} onSubmit={event => { event.preventDefault(); void ask(text); }}>
          <textarea ref={input} rows={1} value={text} maxLength={2000} aria-label="Вопрос ассистенту" placeholder="Спросите о странице…" onChange={event => setText(event.target.value)}
            onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void ask(text); } }} />
          <button type="submit" className={styles.send} aria-label="Отправить" disabled={busy || !text.trim()}><ArrowUp size={16} aria-hidden="true" /></button>
        </form>
        <div className={styles.hint}><span>Enter — отправить{page ? "" : " · Esc — закрыть"}</span>{entries.length > 0 && <button type="button" className={styles.linkBtn} onClick={clear}>Очистить</button>}</div>
      </div>
    </aside>}
  </>;
}
