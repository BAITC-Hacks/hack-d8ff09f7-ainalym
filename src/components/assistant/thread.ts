"use client";
import type { AssistantResult } from "./types";

/** One shared conversation for the side dock and the /assistant surface (localStorage, 12 h TTL, `storage` sync across windows). */
export type ThreadEntry = {
  id: string; at: number;
  /** Typed question or a voice tool call, answered with a result card. */
  question?: string; response?: AssistantResult;
  /** Spoken turn (voice captions) without a card. */
  say?: { who: "user" | "assistant"; text: string };
  /** Structured render hint from a voice tool result (VOICE-FIX-2), when present. */
  render?: Record<string, unknown>;
};
/** Transcript captions must be Cyrillic/Latin/digits (plus punctuation) — anything else is a transcription artefact and is dropped. */
export function cleanCaption(text: string): string | null {
  const value = text.trim();
  if (!value) return null;
  if (/[^\p{Script=Cyrillic}\p{Script=Latin}\p{N}\p{P}\p{S}\p{Z}\s]/u.test(value)) return null;
  return value;
}
export const THREAD_KEY = "ainalym.assistant.thread.v1";
const THREAD_TTL = 12 * 60 * 60 * 1000;
const LIMIT = 60;

export function loadThread(): ThreadEntry[] {
  try {
    const raw = localStorage.getItem(THREAD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { at?: number; entries?: ThreadEntry[] };
    if (!parsed.at || Date.now() - parsed.at > THREAD_TTL || !Array.isArray(parsed.entries)) return [];
    return parsed.entries.filter(entry => entry && typeof entry === "object" && typeof entry.id === "string").slice(-LIMIT);
  } catch { return []; }
}
export function saveThread(entries: ThreadEntry[]) {
  try { localStorage.setItem(THREAD_KEY, JSON.stringify({ at: Date.now(), entries: entries.slice(-LIMIT) })); } catch { /* storage may be unavailable */ }
}
export function newEntry(entry: Omit<ThreadEntry, "id" | "at">): ThreadEntry {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { id, at: Date.now(), ...entry };
}
