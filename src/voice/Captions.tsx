"use client";
// Seam (L5 implements): transcript lines labelled user / assistant / tool.
import type { Caption } from "./useVoiceSession";
export function Captions({ lines }: { lines: Caption[] }) {
  if (!lines.length) return null;
  return (
    <ul aria-label="Субтитры">
      {lines.map((l, i) => (
        <li key={i} data-who={l.who}>{l.text}</li>
      ))}
    </ul>
  );
}
