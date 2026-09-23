"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type SetStateAction } from "react";
import { ArrowDown, ArrowUp, Mic, MicOff, Square, X } from "lucide-react";
import { Chip } from "@/components/labels";
import { ActionStatus, apiRequest, Button, useApi, useApiAction } from "@/components/shell";
import { useVoiceSession } from "@/voice/useVoiceSession";
import { Captions } from "@/voice/Captions";
import { ResultCard } from "./ResultCard";
import { VoiceStateStrip } from "./VoiceStateStrip";
import { TOOLS, type AssistantResult, type AssistantScope, type ToolName } from "./types";
import styles from "./assistant.module.css";

export type AssistantPanelProps = { scope?: AssistantScope; onClose?: () => void; variant?: "panel" | "page" };
type Entry = { id: string; title: string; response: AssistantResult; scope: AssistantScope };
const DEFAULT_SCOPE: AssistantScope = { org_id: "partner" };

export function AssistantPanel({ scope = DEFAULT_SCOPE, onClose, variant = "panel" }: AssistantPanelProps) {
  const id = useId();
  const voice = useVoiceSession(scope);
  const health = useApi<{ providers?: { voice?: string }; mode?: string }>("/api/health");
  const action = useApiAction();
  const [entries, setEntries] = useState<Entry[]>([]);
  const scopeKey = [scope.org_id, scope.supplier_id ?? "", scope.code_1c ?? ""].join(":");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const text = drafts[scopeKey] ?? "";
  function setText(value: SetStateAction<string>) { setDrafts(previous => ({ ...previous, [scopeKey]: typeof value === "function" ? value(previous[scopeKey] ?? "") : value })); }
  const voiceScope = useRef(scopeKey);
  const captionOffset = useRef(0);
  const visibleCaptions = voice.captions.slice(voiceScope.current === scopeKey ? captionOffset.current : voice.captions.length);
  const [tool, setTool] = useState<ToolName | null>(null);
  const [supplier, setSupplier] = useState(scope.supplier_id ?? "SE");
  const [category, setCategory] = useState("");
  const [code, setCode] = useState(scope.code_1c ?? "");
  const [muted, setMuted] = useState(false);
  const [unread, setUnread] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const [availableHeight, setAvailableHeight] = useState<number>();
  const follow = useRef(true);
  const composer = useRef<HTMLTextAreaElement>(null);
  const root = useRef<HTMLElement>(null);
  const retry = useRef<{ path: string; body: object; title: string } | null>(null);
  const unavailable = voice.state === "unavailable" || health.data?.providers?.voice === "missing";
  const voiceState = unavailable ? "unavailable" : voice.state;
  const activeVoice = ["connecting", "listening", "checking", "preparing", "waiting_review"].includes(voiceState);

  async function request(path: string, body: object, title: string) {
    retry.current = { path, body, title };
    const response = await action.run(() => apiRequest<AssistantResult>(path, { method: "POST", body: JSON.stringify(body) }), "Ответ получен");
    if (response) {
      setEntries(previous => [...previous, { id: String((body as { request_id: string }).request_id), title, response, scope: { ...(body as { scope: AssistantScope }).scope } }]);
      retry.current = null;
      return true;
    }
    return false;
  }
  async function runTool(name: ToolName, args: Record<string, unknown> = {}) {
    if (action.busy) return;
    await request(`/api/voice/tools/${name}`, { request_id: crypto.randomUUID(), scope, args }, TOOLS.find(item => item.name === name)!.title);
  }
  function selectTool(name: ToolName) {
    if (action.busy) return;
    if (name === "recommend_for" || name === "explain_sku") setTool(current => current === name ? null : name);
    else { setTool(null); void runTool(name); }
  }
  async function sendText() {
    if (action.busy || !text.trim()) { composer.current?.focus(); return; }
    const sent = text.trim();
    if (await request("/api/assistant/message", { text: sent, scope, request_id: crypto.randomUUID() }, sent)) setText(current => current.trim() === sent ? "" : current);
  }
  useEffect(() => {
    if (voiceScope.current !== scopeKey) { voiceScope.current = scopeKey; captionOffset.current = voice.captions.length; voice.stop(); }
  }, [scopeKey, voice]);
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<{ request_id?: unknown; tool?: unknown; result?: AssistantResult }>).detail;
      const selected = TOOLS.find(item => item.name === detail?.tool);
      if (!activeVoice || !selected || typeof detail?.request_id !== "string" || detail.result?.ok !== true) return;
      const entry: Entry = { id: detail.request_id, title: selected.title, response: detail.result, scope: { ...scope } };
      setEntries(previous => previous.some(item => item.id === entry.id) ? previous : [...previous, entry]);
    };
    window.addEventListener("ainalym:voice-tool-result", receive);
    return () => window.removeEventListener("ainalym:voice-tool-result", receive);
  }, [activeVoice, scope]);
  useEffect(() => {
    if (follow.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
    else if (entries.length || voice.captions.length) setUnread(true);
  }, [entries, voice.captions]);
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (root.current && window.innerWidth > 767) setAvailableHeight(Math.max(360, window.innerHeight - root.current.getBoundingClientRect().top - 24));
      });
    };
    const observer = new ResizeObserver(measure);
    if (root.current?.closest("main")?.parentElement) observer.observe(root.current.closest("main")!.parentElement!);
    window.addEventListener("resize", measure); measure();
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); cancelAnimationFrame(frame); };
  }, []);
  useEffect(() => {
    if (tool && scroll.current) { scroll.current.scrollTop = scroll.current.scrollHeight; scroll.current.querySelector<HTMLElement>("form select,form input")?.focus(); }
  }, [tool]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    let restore = () => {};
    function update() {
      restore();
      if (!media.matches || !root.current) return;
      const focused = document.activeElement as HTMLElement | null;
      const previous: { element: HTMLElement; inert: boolean }[] = [];
      let node: HTMLElement | null = root.current;
      while (node?.parentElement && node.parentElement !== document.documentElement) {
        for (const sibling of Array.from(node.parentElement.children)) {
          if (sibling !== node && sibling instanceof HTMLElement) { previous.push({ element: sibling, inert: sibling.inert }); sibling.inert = true; }
        }
        node = node.parentElement;
      }
      const oldOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      root.current.querySelector<HTMLElement>("button,a")?.focus();
      restore = () => { for (const item of previous) item.element.inert = item.inert; document.body.style.overflow = oldOverflow; if (focused?.isConnected) focused.focus(); };
    }
    update(); media.addEventListener("change", update);
    return () => { media.removeEventListener("change", update); restore(); };
  }, []);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.altKey || event.metaKey || event.ctrlKey || event.defaultPrevented || (event.target as HTMLElement).closest("input,textarea,select,[contenteditable=true],dialog")) return;
      if (variant !== "page" && !root.current?.contains(document.activeElement)) return;
      if (event.key === "Escape" && onClose) { event.preventDefault(); onClose(); }
      if (event.key === " " && activeVoice) { event.preventDefault(); voice.interrupt(); }
      if (event.key === "i") { event.preventDefault(); composer.current?.focus(); }
      const selected = TOOLS.find(item => item.key === event.key);
      if (selected) { event.preventDefault(); document.getElementById(`${id}-${selected.name}`)?.click(); }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [activeVoice, id, onClose, variant, voice]);

  return <section ref={root} style={availableHeight ? { "--assistant-available-height": `${availableHeight}px` } as React.CSSProperties : undefined} className={`${styles.panel} ${variant === "page" ? styles.pagePanel : ""}`} aria-label="Помощник по пополнению склада">
    <header className={styles.header}><div><h2>Помощник</h2><p className={styles.meta}>{scope.code_1c ? `Код ${scope.code_1c}` : scope.supplier_id ? `Поставщик ${scope.supplier_id}` : "По всем поставщикам"}</p></div>{onClose ? <Button variant="quiet" aria-label="Закрыть помощника" onClick={onClose}><X size={18} /></Button> : <Link className={styles.closeLink} href="/today" aria-label="Вернуться на Сегодня"><X size={18} /></Link>}</header>
    <VoiceStateStrip state={voiceState} muted={muted} />
    <div className={styles.conversation} ref={scroll} onScroll={() => { const node = scroll.current; if (node) { follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 48; if (follow.current) setUnread(false); } }}>
      <div className={styles.intro}><p>Решения, изменения и расчёт заказа — из данных вашего склада.</p><p className={styles.meta}>Помощник готовит рекомендации. Вы утверждаете заказ.</p></div>
      <Captions lines={visibleCaptions} />
      <div className={styles.results}>{entries.map(entry => <div key={entry.id}><p className={styles.entryScope}>{entry.scope.code_1c ? `Ответ по коду ${entry.scope.code_1c}` : entry.scope.supplier_id ? `Ответ по поставщику ${entry.scope.supplier_id}` : "Ответ по всем поставщикам"}</p><ResultCard title={entry.title} response={entry.response} /></div>)}</div>
      {tool && <form className={styles.toolForm} aria-busy={action.busy} onSubmit={event => { event.preventDefault(); void runTool(tool, tool === "recommend_for" ? { ...((scope.supplier_id ?? supplier) ? { supplier_id: scope.supplier_id ?? supplier } : {}), ...(category.trim() ? { category: category.trim() } : {}) } : { code_1c: scope.code_1c ?? code.trim() }); }}>
        {tool === "recommend_for" ? <><label>Поставщик<select value={scope.supplier_id ?? supplier} onChange={event => setSupplier(event.target.value)} disabled={!!scope.supplier_id || action.busy}><option value="SE">SE</option><option value="IEK">IEK</option><option value="">Все поставщики</option></select></label><label>Категория{!(scope.supplier_id ?? supplier) ? " (обязательно)" : " (необязательно)"}<input value={category} onChange={event => setCategory(event.target.value)} required={!(scope.supplier_id ?? supplier)} disabled={action.busy} /></label></> : <label>Код 1С<input autoFocus value={scope.code_1c ?? code} onChange={event => setCode(event.target.value)} required disabled={!!scope.code_1c || action.busy} /></label>}
        <Button type="submit" busy={action.busy}>{tool === "recommend_for" ? "Подготовить расчёт" : "Объяснить товар"}</Button>
      </form>}
    </div>
    {unread && <Button className={styles.follow} onClick={() => { follow.current = true; if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; setUnread(false); }}><ArrowDown size={14} />К новым</Button>}
    <div className={styles.footer}>
      <div className={styles.tools} aria-label="Инструменты помощника">{TOOLS.map(item => <Button key={item.name} id={`${id}-${item.name}`} onClick={() => selectTool(item.name)} aria-expanded={item.name === "recommend_for" || item.name === "explain_sku" ? tool === item.name : undefined} aria-keyshortcuts={item.key} busy={action.busy && retry.current?.title === item.title}><span>{item.title}</span><kbd>{item.key}</kbd></Button>)}</div>
      <div className={styles.feedback}><ActionStatus error={action.error} receipt={action.receipt} />{action.error && retry.current && <Button onClick={() => { const last = retry.current; if (last) void request(last.path, last.body, last.title); }} busy={action.busy}>Повторить запрос</Button>}</div>
      <form className={styles.composer} onSubmit={event => { event.preventDefault(); void sendText(); }} aria-busy={action.busy}>
        <label className={styles.textLabel} htmlFor={`${id}-text`}>Сообщение помощнику</label>
        <textarea ref={composer} id={`${id}-text`} rows={2} value={text} maxLength={4000} onChange={event => setText(event.target.value)} placeholder="Спросите о пополнении склада…" onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void sendText(); } }} />
        <div className={styles.composerActions}><span className={styles.meta}>Enter — отправить</span><Button type="button" aria-label={activeVoice ? "Завершить голосовой разговор" : "Начать голосовой разговор"} disabled={health.data?.providers?.voice === "missing" || (unavailable && voice.reason === "voice pending")} onClick={() => { setMuted(false); if (activeVoice) voice.stop(); else void voice.start(); }}>{activeVoice ? <Square size={16} /> : <Mic size={18} />}</Button>{activeVoice && <Button type="button" aria-label={muted ? "Включить микрофон" : "Выключить микрофон"} aria-pressed={muted} onClick={() => { voice.mute(!muted); setMuted(!muted); }}>{muted ? <MicOff size={18} /> : <Mic size={18} />}</Button>}<Button type="submit" variant="primary" aria-label="Отправить сообщение" busy={action.busy}><ArrowUp size={18} /></Button></div>
      </form>
      <div className={styles.voiceMeta}><span>Realtime + async speech</span>{unavailable && <Chip title={voice.reason}>Provider unavailable</Chip>}</div>
    </div>
  </section>;
}
