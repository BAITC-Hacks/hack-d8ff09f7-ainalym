"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApi } from "@/components/shell";
import { useVoiceSession, type VoiceScope, type VoiceSession, type VoiceState } from "@/voice/useVoiceSession";
import { TOOLS, type AssistantResult } from "./types";
import type { WaveState } from "./VoiceWave";
import { newEntry, type ThreadEntry } from "./thread";

/** Fields the voice lane may expose later; read defensively so this compiles against today's hook. */
type VoiceExtras = { audioBlocked?: boolean; enableAudio?: () => void; localStream?: MediaStream | null; remoteStream?: MediaStream | null };
const ACTIVE: VoiceState[] = ["connecting", "listening", "checking", "preparing", "waiting_review"];
const NO_VOICE = "Голос сейчас недоступен — печатайте";

export type AssistantVoice = {
  session: VoiceSession; state: VoiceState; active: boolean; unavailable: boolean;
  mic: WaveState; label: string; local: MediaStream | null; remote: MediaStream | null;
  audioBlocked: boolean; enableAudio?: () => void; toggle: () => void; stop: () => void;
};

/**
 * Voice for the assistant surfaces: wraps the session hook, folds captions and tool results into the shared thread,
 * derives the mic state (idle / listening / thinking / speaking) and the streams that drive the live wave.
 */
export function useAssistantVoice(scope: VoiceScope, append: (entry: ThreadEntry) => void, typingBusy = false): AssistantVoice {
  const session = useVoiceSession(scope);
  const extras = session as VoiceSession & VoiceExtras;
  const health = useApi<{ providers?: { voice?: string } }>("/api/health");
  const [speaking, setSpeaking] = useState(false);
  const [monitor, setMonitor] = useState<MediaStream | null>(null);
  const seen = useRef(0);
  const appendRef = useRef(append);
  appendRef.current = append;

  const unavailable = session.state === "unavailable" || health.data?.providers?.voice === "missing";
  const active = ACTIVE.includes(session.state);

  // Captions become spoken turns in the shared thread; an assistant caption marks a short «speaking» phase.
  useEffect(() => {
    const lines = session.captions;
    for (let i = seen.current; i < lines.length; i++) {
      const line = lines[i];
      if (line.who === "tool") continue;
      appendRef.current(newEntry({ say: { who: line.who, text: line.text } }));
      if (line.who === "assistant") setSpeaking(true);
    }
    seen.current = lines.length;
  }, [session.captions]);
  useEffect(() => {
    if (!speaking) return;
    const timer = window.setTimeout(() => setSpeaking(false), 3200);
    return () => window.clearTimeout(timer);
  }, [speaking]);
  useEffect(() => { if (!active) setSpeaking(false); }, [active]);

  // Voice tool results become inline cards.
  useEffect(() => {
    const onResult = (event: Event) => {
      const detail = (event as CustomEvent<{ tool?: string; result?: AssistantResult }>).detail;
      if (!detail?.result) return;
      const title = TOOLS.find(tool => tool.name === detail.tool)?.title ?? "Ответ ассистента";
      appendRef.current(newEntry({ question: title, response: detail.result }));
    };
    window.addEventListener("ainalym:voice-tool-result", onResult);
    return () => window.removeEventListener("ainalym:voice-tool-result", onResult);
  }, []);

  // Until the voice lane exposes its microphone stream, open a monitor-only track for the wave while the session is live.
  const exposesLocal = extras.localStream !== undefined;
  useEffect(() => {
    if (!active || exposesLocal || !navigator.mediaDevices?.getUserMedia) { setMonitor(null); return; }
    let cancelled = false; let stream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(media => { if (cancelled) media.getTracks().forEach(track => track.stop()); else { stream = media; setMonitor(media); } }).catch(() => undefined);
    return () => { cancelled = true; stream?.getTracks().forEach(track => track.stop()); setMonitor(null); };
  }, [active, exposesLocal]);

  const local = extras.localStream ?? monitor;
  const remote = extras.remoteStream ?? null;
  const thinking = typingBusy || session.state === "connecting" || session.state === "checking" || session.state === "preparing";
  const mic: WaveState = thinking ? "thinking" : speaking ? "speaking" : session.state === "listening" || session.state === "waiting_review" ? "listening" : "idle";
  const label = unavailable ? NO_VOICE
    : mic === "thinking" ? (typingBusy ? "Смотрю данные…" : session.state === "connecting" ? "Подключаюсь…" : "Проверяю…")
    : mic === "speaking" ? "Отвечаю" : session.state === "waiting_review" ? "Ждёт вашего решения" : mic === "listening" ? "Слушаю — говорите" : "Нажмите и говорите";

  const toggle = useCallback(() => { if (active) session.stop(); else if (!unavailable) void session.start(); }, [active, unavailable, session]);
  return { session, state: session.state, active, unavailable, mic, label, local, remote, audioBlocked: extras.audioBlocked === true, enableAudio: typeof extras.enableAudio === "function" ? extras.enableAudio : undefined, toggle, stop: session.stop };
}
