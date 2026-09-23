"use client";
// Seam (L5 implements): the Realtime voice session hook; the stub renders «unavailable».
export type VoiceState = "idle" | "connecting" | "listening" | "checking" | "preparing" | "waiting_review" | "ended" | "unavailable";
export interface Caption { who: "user" | "assistant" | "tool"; text: string }
export interface VoiceSession { state: VoiceState; reason?: string; start: () => Promise<void>; stop: () => void; mute: (on: boolean) => void; interrupt: () => void; captions: Caption[] }
export function useVoiceSession(_scope: { org_id: string; supplier_id?: string; code_1c?: string }): VoiceSession {
  return { state: "unavailable", reason: "voice pending", start: async () => {}, stop: () => {}, mute: () => {}, interrupt: () => {}, captions: [] };
}
