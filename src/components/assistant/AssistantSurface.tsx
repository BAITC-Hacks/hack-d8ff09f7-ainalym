"use client";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, AudioLines, Mic, Sparkles, Square, Volume2 } from "lucide-react";
import { ResultCard } from "./ResultCard";
import { VoiceWave } from "./VoiceWave";
import { useAssistantVoice } from "./useAssistantVoice";
import { contextTitle, detectBase, pageContext, parseContext, suggestedPrompts, type AssistantContext } from "./context";
import { loadThread, newEntry, saveThread, THREAD_KEY, type ThreadEntry } from "./thread";
import type { AssistantResult } from "./types";
import styles from "./surface.module.css";

const CANNOT_ANSWER = "Не могу ответить по этим данным. Попробуйте открыть карточку товара.";

function readContext(base: string, pathname: string): AssistantContext {
  const fromUrl = parseContext(new URLSearchParams(window.location.search).get("ctx"));
  return fromUrl ?? pageContext(pathname, base);
}

/**
 * The /assistant page: a full-width agentic conversation — transcript in the centre, tool results as inline cards,
 * quick actions, the microphone as the primary control with a live sound wave, typed input beside it.
 * Shares the conversation with the side dock on other pages.
 */
export function AssistantSurface({ base: baseProp }: { base?: string }) {
  const pathname = usePathname() ?? "";
  const base = baseProp ?? detectBase(pathname);
  const [entries, setEntries] = useState<ThreadEntry[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [ctx, setCtx] = useState<AssistantContext>({ route: "assistant", entity: {} });
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const append = useCallback((entry: ThreadEntry) => setEntries(previous => { const next = [...previous, entry]; saveThread(next); return next; }), []);
  const voice = useAssistantVoice({ org_id: "partner", ...(ctx.entity.supplier_id ? { supplier_id: ctx.entity.supplier_id } : {}), ...(ctx.entity.code_1c ? { code_1c: ctx.entity.code_1c } : {}) }, append, busy);

  useEffect(() => {
    setEntries(loadThread());
    setCtx(readContext(base, pathname));
    if (window.opener) document.documentElement.dataset.assistantPopup = "1";
    const sync = (event: StorageEvent) => { if (event.key === THREAD_KEY) setEntries(loadThread()); };
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("storage", sync); delete document.documentElement.dataset.assistantPopup; };
  }, [base, pathname]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [entries.length, busy]);

  const ask = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q || busy) { input.current?.focus(); return; }
    setBusy(true);
    setText("");
    let response: AssistantResult;
    try {
      const res = await fetch("/api/assistant/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: q, context: ctx, base }) });
      response = res.ok ? await res.json() as AssistantResult : { ok: false, reply_ru: CANNOT_ANSWER };
    } catch { response = { ok: false, reply_ru: CANNOT_ANSWER }; }
    append(newEntry({ question: q, response }));
    setBusy(false);
    input.current?.focus();
  }, [append, base, busy, ctx]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && (key === "k" || key === "j")) {
        event.preventDefault(); event.stopPropagation(); input.current?.focus(); return;
      }
      if (event.key === "Escape" && voice.active) { event.preventDefault(); event.stopPropagation(); voice.stop(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [voice]);

  function clear() { setEntries([]); saveThread([]); input.current?.focus(); }
  const title = contextTitle(ctx);
  const chips = suggestedPrompts(ctx);
  const live = voice.active;
  const MicIcon = live ? Square : Mic;

  return <section className={styles.surface} aria-label="Помощник">
    <div className={styles.column}>
      <header className={styles.head}>
        <div><h1 className={styles.title}>Помощник</h1><p className={styles.sub}>Отвечаю по данным склада{ctx.route !== "assistant" && ctx.route !== "other" ? ` — ${title}` : ""}. Голосом или текстом.</p></div>
        {entries.length > 0 && <button type="button" className={styles.linkBtn} onClick={clear}>Очистить разговор</button>}
      </header>
      <div className={styles.transcript} aria-live="polite">
        {entries.length === 0 && !busy && <div className={styles.empty}>
          <span className={styles.spark}><Sparkles size={22} aria-hidden="true" /></span>
          <h2>Чем помочь?</h2>
          <p>Нажмите на микрофон и спросите — или выберите вопрос ниже. Что срочно, что заплатить, почему такое количество.</p>
        </div>}
        {entries.map(entry => entry.say
          ? <div key={entry.id} className={`${styles.turn} ${entry.say.who === "user" ? styles.user : styles.assistant}`} data-who={entry.say.who}>
              {entry.say.who === "assistant" && <span className={styles.mark} aria-hidden="true"><AudioLines size={14} /></span>}
              <p className={styles.bubble}>{entry.say.text}</p>
            </div>
          : <div key={entry.id} className={styles.exchange}>
              <div className={`${styles.turn} ${styles.user}`} data-who="user"><p className={styles.bubble}>{entry.question}</p></div>
              <div className={`${styles.turn} ${styles.assistant}`} data-who="assistant">
                <span className={styles.mark} aria-hidden="true"><Sparkles size={14} /></span>
                <div className={styles.card}><ResultCard title={entry.question ?? ""} response={entry.response ?? { ok: false, reply_ru: CANNOT_ANSWER }} plain base={base} hideTitle /></div>
              </div>
            </div>)}
        {busy && <div className={`${styles.turn} ${styles.assistant}`}><span className={styles.mark} aria-hidden="true"><Sparkles size={14} /></span><p className={`${styles.bubble} ${styles.status}`} role="status">Смотрю данные…</p></div>}
        <div ref={end} />
      </div>
    </div>
    <div className={styles.bar}>
      <div className={styles.column}>
        <div className={styles.chips} aria-label="Быстрые действия">{chips.map(chip => <button key={chip.id} type="button" className={styles.chip} disabled={busy} onClick={() => void ask(chip.text)}>{chip.text}</button>)}</div>
        <div className={styles.waveRow} data-live={live ? "1" : undefined}>
          {live || busy ? <VoiceWave local={voice.local} remote={voice.remote} state={voice.mic === "idle" ? "listening" : voice.mic} /> : null}
        </div>
        <div className={styles.controls}>
          <form className={styles.composer} onSubmit={event => { event.preventDefault(); void ask(text); }}>
            <textarea ref={input} rows={1} value={text} maxLength={2000} aria-label="Вопрос ассистенту" placeholder="Спросите о складе, заказе или позиции…" onChange={event => setText(event.target.value)}
              onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void ask(text); } }} />
            <button type="submit" className={styles.send} aria-label="Отправить" disabled={busy || !text.trim()}><ArrowUp size={16} aria-hidden="true" /></button>
          </form>
          <button type="button" className={styles.mic} data-state={voice.mic} aria-pressed={live} aria-label={live ? "Остановить разговор (Esc)" : "Говорить с ассистентом"} title={voice.label} disabled={voice.unavailable} onClick={voice.toggle}>
            <MicIcon size={live ? 22 : 26} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.state} role="status">
          <span>{voice.label}</span>
          {voice.audioBlocked && voice.enableAudio && <button type="button" className={styles.soundBtn} onClick={voice.enableAudio}><Volume2 size={14} aria-hidden="true" />Включить звук</button>}
        </div>
        <p className={styles.hint}><span>Enter — отправить</span><span>⌘K — ввод</span><span>Esc — стоп</span></p>
      </div>
    </div>
  </section>;
}
