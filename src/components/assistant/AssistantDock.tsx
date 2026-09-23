"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, ExternalLink, Mic, Sparkles, Square, Volume2, X } from "lucide-react";
import { ResultCard } from "./ResultCard";
import { VoiceWave } from "./VoiceWave";
import { useAssistantVoice } from "./useAssistantVoice";
import { contextTitle, detectBase, encodeContext, pageContext, suggestedPrompts, type AssistantContext } from "./context";
import { loadThread, newEntry, saveThread, THREAD_KEY, type ThreadEntry } from "./thread";
import type { AssistantResult } from "./types";
import styles from "./dock.module.css";

const CANNOT_ANSWER = "Не могу ответить по этим данным. Попробуйте открыть карточку товара.";

function readContext(base: string, pathname: string): AssistantContext {
  return pageContext(pathname, base, document.querySelector("[data-ainalym-context]")?.getAttribute("data-ainalym-context"));
}

/**
 * Linear-style assistant side sheet. Shell-agnostic: mount once; `base` is the route prefix ("" when the shell is served at /,
 * detected from the URL when omitted). Opens from the «ИИ-ассистент» nav item or ⌘J / Ctrl+J, closes with Esc.
 * On `${base}/assistant` the sheet yields to the full-width surface and the nav item becomes a link to it.
 */
export function AssistantDock({ base: baseProp }: { base?: string }) {
  const pathname = usePathname() ?? "";
  const base = baseProp ?? detectBase(pathname);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ThreadEntry[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [ctx, setCtx] = useState<AssistantContext>({ route: "other", entity: {} });
  const [navHost, setNavHost] = useState<Element | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const onSurface = pathname === `${base}/assistant`;
  const append = useCallback((entry: ThreadEntry) => setEntries(previous => { const next = [...previous, entry]; saveThread(next); return next; }), []);
  const voice = useAssistantVoice({ org_id: "partner", ...(ctx.entity.supplier_id ? { supplier_id: ctx.entity.supplier_id } : {}), ...(ctx.entity.code_1c ? { code_1c: ctx.entity.code_1c } : {}) }, append, busy);

  useEffect(() => {
    setEntries(loadThread());
    const sync = (event: StorageEvent) => { if (event.key === THREAD_KEY) setEntries(loadThread()); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const refreshContext = useCallback(() => setCtx(readContext(base, pathname)), [base, pathname]);
  useEffect(() => {
    refreshContext();
    window.addEventListener("ainalym:context", refreshContext);
    return () => window.removeEventListener("ainalym:context", refreshContext);
  }, [refreshContext]);
  useEffect(() => { setNavHost(document.querySelector('aside[aria-label="Разделы"] nav')); }, [pathname]);
  useEffect(() => { body.current?.scrollTo({ top: body.current.scrollHeight }); }, [entries, busy]);

  const show = useCallback(() => {
    opener.current = document.activeElement as HTMLElement | null;
    setCtx(readContext(base, pathname));
    setOpen(true);
    requestAnimationFrame(() => input.current?.focus());
  }, [base, pathname]);
  const hide = useCallback(() => { setOpen(false); opener.current?.focus?.(); }, []);

  useEffect(() => {
    if (onSurface) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "j") {
        event.preventDefault();
        if (open) hide(); else show();
        return;
      }
      if (event.key === "Escape" && open) { event.preventDefault(); if (voice.active) voice.stop(); else hide(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSurface, open, show, hide, voice]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) { input.current?.focus(); return; }
    setBusy(true);
    setText("");
    const context = readContext(base, pathname);
    setCtx(context);
    let response: AssistantResult;
    try {
      const res = await fetch("/api/assistant/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: q, context, base }) });
      response = res.ok ? await res.json() as AssistantResult : { ok: false, reply_ru: CANNOT_ANSWER };
    } catch { response = { ok: false, reply_ru: CANNOT_ANSWER }; }
    append(newEntry({ question: q, response }));
    setBusy(false);
    input.current?.focus();
  }
  function openSeparately() {
    window.open(`${base}/assistant?ctx=${encodeContext(ctx)}`, "ainalym-assistant", "popup=yes,width=480,height=760");
    hide();
  }
  function clear() { setEntries([]); saveThread([]); input.current?.focus(); }

  const title = contextTitle(ctx);
  const chips = suggestedPrompts(ctx);
  const live = voice.active;
  const trigger = navHost ? createPortal(
    onSurface
      ? <Link href={`${base}/assistant`} prefetch={false} className={styles.navTrigger} aria-current="page" data-active="1"><span className={styles.navLabel}><Sparkles size={15} aria-hidden="true" />ИИ-ассистент</span></Link>
      : <button type="button" className={styles.navTrigger} aria-expanded={open} aria-controls={`${id}-dock`} aria-keyshortcuts="Meta+J Control+J" onClick={() => open ? hide() : show()}>
          <span className={styles.navLabel}><Sparkles size={15} aria-hidden="true" />ИИ-ассистент</span><kbd aria-hidden="true">⌘J</kbd>
        </button>, navHost) : null;
  if (onSurface) return <>{trigger}</>;
  return <>
    {trigger}
    {open && <aside id={`${id}-dock`} role="dialog" aria-label="ИИ-ассистент" className={styles.sheet}>
      <header className={styles.head}>
        <Sparkles size={16} aria-hidden="true" className={styles.spark} />
        <h2 className={styles.title}>ИИ-ассистент</h2>
        <span className={styles.scope} title={title}>{title}</span>
        <div className={styles.headActions}>
          <button type="button" className={styles.iconBtn} onClick={openSeparately}><ExternalLink size={14} aria-hidden="true" />Открыть отдельно</button>
          <button type="button" className={styles.iconBtn} aria-label="Закрыть (Esc)" onClick={hide}><X size={16} aria-hidden="true" /></button>
        </div>
      </header>
      <div className={styles.body} ref={body} aria-live="polite">
        {entries.length === 0 && <p className={styles.intro}>Отвечаю по данным этой страницы — {title}. Выберите вопрос ниже, напишите свой или нажмите на микрофон.</p>}
        {entries.map(entry => entry.say
          ? <p key={entry.id} className={`${styles.say} ${entry.say.who === "user" ? styles.sayUser : ""}`}><span className={styles.who}>{entry.say.who === "user" ? "Вы" : "Ассистент"}</span>{entry.say.text}</p>
          : <ResultCard key={entry.id} title={entry.question ?? ""} response={entry.response ?? { ok: false, reply_ru: CANNOT_ANSWER }} plain base={base} />)}
        {busy && <p className={styles.status} role="status">Смотрю данные…</p>}
      </div>
      <div className={styles.foot}>
        {live && <div className={styles.live}><VoiceWave local={voice.local} remote={voice.remote} state={voice.mic === "idle" ? "listening" : voice.mic} size="mini" /><span role="status">{voice.label}</span>{voice.audioBlocked && voice.enableAudio && <button type="button" className={styles.linkBtn} onClick={voice.enableAudio}><Volume2 size={12} aria-hidden="true" /> Включить звук</button>}</div>}
        <div className={styles.chips} aria-label="Подсказки">{chips.map(chip => <button key={chip.id} type="button" className={styles.chip} disabled={busy} onClick={() => void ask(chip.text)}>{chip.text}</button>)}</div>
        <form className={styles.composer} onSubmit={event => { event.preventDefault(); void ask(text); }}>
          <button type="button" className={styles.mic} data-state={voice.mic} aria-pressed={live} aria-label={live ? "Остановить разговор (Esc)" : "Говорить с ассистентом"} title={voice.label} disabled={voice.unavailable} onClick={voice.toggle}>{live ? <Square size={14} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}</button>
          <textarea ref={input} rows={1} value={text} maxLength={2000} aria-label="Вопрос ассистенту" placeholder="Спросите о странице…" onChange={event => setText(event.target.value)}
            onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void ask(text); } }} />
          <button type="submit" className={styles.send} aria-label="Отправить" disabled={busy || !text.trim()}><ArrowUp size={16} aria-hidden="true" /></button>
        </form>
        <div className={styles.hint}><span>Enter — отправить · Esc — {live ? "стоп" : "закрыть"}</span>{entries.length > 0 && <button type="button" className={styles.linkBtn} onClick={clear}>Очистить</button>}</div>
      </div>
    </aside>}
  </>;
}
