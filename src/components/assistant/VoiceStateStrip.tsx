import { AudioLines, MicOff } from "lucide-react";
import type { VoiceState } from "@/voice/useVoiceSession";
import styles from "./assistant.module.css";

export const VOICE_STATES: Record<VoiceState, string> = {
  idle: "Готов к разговору", connecting: "Подключаюсь", listening: "Слушаю", checking: "Проверяю",
  preparing: "Готовлю", waiting_review: "Ждёт вашей проверки", ended: "Завершено", unavailable: "Голос недоступен — печатайте",
};
export function VoiceStateStrip({ state, muted = false }: { state: VoiceState; muted?: boolean }) {
  const Icon = state === "unavailable" || muted ? MicOff : AudioLines;
  return <div className={styles.voiceState} data-state={state} role="status"><Icon size={16} aria-hidden="true" /><span>{muted && state === "listening" ? "Микрофон выключен" : VOICE_STATES[state]}</span></div>;
}
