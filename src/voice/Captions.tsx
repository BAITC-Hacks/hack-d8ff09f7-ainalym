"use client";
import type { Caption } from "./useVoiceSession";
const speakers: Record<Caption["who"], string> = { user: "Вы", assistant: "Ainalym", tool: "Инструмент" };
export function Captions({ lines }: { lines: Caption[] }) {
  if (!lines.length) return null;
  return <ol aria-label="Субтитры" aria-live="polite">
    {lines.map((line, index) => <li key={index} data-who={line.who}><strong>{speakers[line.who]}:</strong> {line.who === "tool" ? "Проверяю…" : line.text}</li>)}
  </ol>;
}
