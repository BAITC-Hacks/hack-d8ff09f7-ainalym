"use client";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, AudioLines, Mic, MicOff, Sparkles, Square, Volume2 } from "lucide-react";
import { ResultCard } from "./ResultCard";
import { FollowUps, revealMs } from "./Reveal";
import { isRenderSpec, StructuredCard } from "./StructuredCard";
import { VoiceWave } from "./VoiceWave";
import { useAssistantVoice } from "./useAssistantVoice";
import { contextTitle, detectBase, pageContext, parseContext, suggestedPrompts, type AssistantContext } from "./context";
import { loadThread, newEntry, saveThread, THREAD_KEY, type ThreadEntry } from "./thread";
import type { AssistantResult } from "./types";
import styles from "./surface.module.css";

const CANNOT_ANSWER = "Не могу ответить по этим данным. Попробуйте открыть карточку товара.";
/** An answer is «fresh» (typing reveal + chips land at its end) only for a few seconds after it arrived. */
const FRESH_MS = 4000;
const DEFAULT_FOLLOWUPS = ["Что срочно?", "Что нужно от меня?"];

function readContext(base: string, pathname: string): AssistantContext {
  const fromUrl = parseContext(new URLSearchParams(window.location.search).get("ctx"));
  return fromUrl ?? pageContext(pathname, base);
}
/** Follow-up offers for an answer: the server's data-tied ones, or a deterministic pair for voice cards and errors. */
export function followUpsOf(entry: ThreadEntry): string[] {
  const own = entry.response?.followups?.filter(item => typeof item === "string" && item.trim()) ?? [];
  const list = own.length ? own : DEFAULT_FOLLOWUPS;
  return list.filter(item => item !== entry.question).slice(0, 2);
}
/** The one proactive opening question for the current page. */
function greetingQuestion(ctx: AssistantContext): string {
  if (ctx.route === "sku") return "Почему столько?";
  if (ctx.route === "money") return "Что заплатить на этой неделе?";
  if (ctx.entity.po_id) return "Почему заказ такой?";
  return "Что срочно?";
}

/**
 * The /assistant page: a full-width agentic conversation — transcript in the centre, tool results as inline cards,
 * quick actions, a big green «Говорить с помощником» button beside the send button, a compact mic toggle for a live session.
 * Shares the conversation with the side dock on other pages.
 */
export function AssistantSurface({ base: baseProp }: { base?: string }) {
  const pathname = usePathname() ?? "";
  const base = baseProp ?? detectBase(pathname);
  const [entries, setEntries] = useState<ThreadEntry[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [ctx, setCtx] = useState<AssistantContext>({ route: "assistant", entity: {} });
  const [greeting, setGreeting] = useState<{ line: string; ask: string } | null>(null);
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

  // Proactive opener: one context-aware line from the data, offered — not pushed — into the thread.
  useEffect(() => {
    if (entries.length > 0 || greeting) return;
    const question = greetingQuestion(ctx);
    let cancelled = false;
    fetch("/api/assistant/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: question, context: ctx, base }) })
      .then(res => res.ok ? res.json() as Promise<AssistantResult> : null)
      .then(result => {
        if (cancelled || !result?.ok || !result.reply_ru) return;
        const first = result.reply_ru.split(/(?<=[.!?])\s+/)[0]?.replace(/[.!]$/, "") ?? "";
        if (first) setGreeting({ line: first, ask: question });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [entries.length, greeting, ctx, base]);

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

  function clear() { setEntries([]); saveThread([]); setGreeting(null); input.current?.focus(); }
  const title = contextTitle(ctx);
  const chips = suggestedPrompts(ctx);
  const live = voice.active;
  const now = Date.now();
  const last = entries[entries.length - 1];

  return <section className={styles.surface} aria-label="ИИ-Помощник" aria-busy={busy}>
    <div className={styles.column}>
      <header className={styles.head}>
        <div><h1 className={styles.title}>ИИ-Помощник</h1><p className={styles.sub}>Отвечаю по данным склада{ctx.route !== "assistant" && ctx.route !== "other" ? ` — ${title}` : ""}. Голосом или текстом.</p></div>
        {entries.length > 0 && <button type="button" className={styles.linkBtn} onClick={clear}>Очистить разговор</button>}
      </header>
      <div className={styles.transcript} aria-live="polite">
        {entries.length === 0 && !busy && <div className={styles.empty}>
          <span className={styles.spark}><Sparkles size={22} aria-hidden="true" /></span>
          <h2>Чем помочь?</h2>
          {greeting
            ? <p className={styles.greet}><span>{greeting.line} —</span><button type="button" className={styles.chip} onClick={() => void ask(greeting.ask)}>показать?</button></p>
            : <p>Напишите вопрос или нажмите «Говорить с помощником» — отвечу по данным склада: что срочно, что заплатить, почему такое количество.</p>}
        </div>}
        {entries.map(entry => entry.say
          ? <div key={entry.id} className={`${styles.turn} ${entry.say.who === "user" ? styles.user : styles.assistant}`} data-who={entry.say.who}>
              {entry.say.who === "assistant" && <span className={styles.mark} aria-hidden="true"><AudioLines size={14} /></span>}
              <p className={styles.bubble}>{entry.say.text}</p>
            </div>
          : (() => {
              const fresh = now - entry.at < FRESH_MS;
              const response = entry.response ?? { ok: false, reply_ru: CANNOT_ANSWER };
              const delay = fresh ? revealMs(`${response.reply_ru ?? ""} ${response.result?.rationale_ru ?? response.rationale_ru ?? ""}`) + 120 : 0;
              return <div key={entry.id} className={styles.exchange}>
                <div className={`${styles.turn} ${styles.user}`} data-who="user"><p className={styles.bubble}>{entry.question}</p></div>
                <div className={`${styles.turn} ${styles.assistant}`} data-who="assistant">
                  <span className={styles.mark} aria-hidden="true"><Sparkles size={14} /></span>
                  <div className={styles.card}>{isRenderSpec(entry.render) ? <StructuredCard title={entry.question ?? ""} render={entry.render} base={base} /> : <ResultCard title={entry.question ?? ""} response={response} plain base={base} hideTitle reveal={fresh} />}</div>
                </div>
                {entry === last && !busy && <div className={styles.followRow}><FollowUps items={followUpsOf(entry)} delayMs={delay} disabled={busy} onPick={item => void ask(item)} /></div>}
              </div>;
            })())}
        {busy && <div className={`${styles.turn} ${styles.assistant}`}><span className={styles.mark} aria-hidden="true"><Sparkles size={14} /></span><p className={`${styles.bubble} ${styles.typing}`} role="status" aria-label="ИИ-Помощник готовит ответ"><i /><i /><i /><span>Смотрю данные…</span></p></div>}
        <div ref={end} />
      </div>
    </div>
    <div className={styles.bar}>
      <div className={styles.column}>
        <div className={styles.chips} aria-label="Быстрые действия">{chips.map(chip => <button key={chip.id} type="button" className={styles.chip} disabled={busy} onClick={() => void ask(chip.text)}>{chip.text}</button>)}</div>
        <div className={styles.controls}>
          <button type="button" className={styles.micToggle} data-state={voice.micOn ? voice.mic : "off"} aria-pressed={voice.micOn} aria-label="Микрофон вкл/выкл" title={voice.unavailable ? voice.label : voice.micOn ? "Выключить микрофон" : "Включить микрофон"} disabled={voice.unavailable} onClick={voice.toggleMic}>
            {voice.micOn ? <Mic size={18} aria-hidden="true" /> : <MicOff size={18} aria-hidden="true" />}
          </button>
          <form className={styles.composer} onSubmit={event => { event.preventDefault(); void ask(text); }}>
            <textarea ref={input} rows={1} value={text} maxLength={2000} aria-label="Вопрос ассистенту" placeholder="Спросите о складе, заказе или позиции…" onChange={event => setText(event.target.value)}
              onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void ask(text); } }} />
            <button type="submit" className={styles.send} aria-label="Отправить" disabled={busy || !text.trim()}><ArrowUp size={16} aria-hidden="true" /></button>
          </form>
          {/* Starts the voice session inside the click (audio playback is unlocked in the same click stack); while live it ends the session. */}
          <button type="button" className={styles.talk} data-state={live ? voice.mic : "off"} aria-pressed={live} aria-label={live ? "Завершить разговор (Esc)" : "Говорить с помощником"} title={voice.label} disabled={voice.unavailable} onClick={voice.toggle}>
            {live
              ? <><span className={styles.talkWave}><VoiceWave local={voice.local} remote={voice.remote} state={voice.micOn ? (voice.mic === "idle" ? "listening" : voice.mic) : "thinking"} size="mini" /></span><Square size={14} aria-hidden="true" />Завершить</>
              : <><AudioLines size={18} aria-hidden="true" />Говорить с помощником</>}
          </button>
        </div>
        <div className={styles.state} role="status">
          <span>{voice.label}</span>
          {voice.audioBlocked && voice.enableAudio && <button type="button" className={styles.soundBtn} onClick={voice.enableAudio}><Volume2 size={14} aria-hidden="true" />Включить звук</button>}
        </div>
        <p className={styles.hint}><span>Enter — отправить</span><span>⌘K — ввод</span><span>Esc — завершить разговор</span></p>
      </div>
    </div>
  </section>;
}
