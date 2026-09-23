"use client";
import { useEffect, useRef } from "react";
import styles from "./wave.module.css";

export type WaveState = "idle" | "listening" | "thinking" | "speaking";
type Props = { local: MediaStream | null; remote: MediaStream | null; state: WaveState; size?: "full" | "mini"; className?: string };

/**
 * Live sound wave for the voice assistant. Bars follow real audio levels (Web Audio AnalyserNode):
 * listening → the local microphone, speaking → the assistant's remote track, thinking → a slow idle pulse.
 * Canvas at display refresh rate; with reduced motion the bars update a few times a second without easing.
 */
export function VoiceWave({ local, remote, state, size = "full", className }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const bars = size === "mini" ? 20 : 44;

  useEffect(() => {
    const node = canvas.current;
    if (!node || state === "idle") return;
    const ctx = node.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const source = state === "listening" ? local : state === "speaking" ? remote : null;
    let audio: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let data: Uint8Array<ArrayBuffer> | null = null;
    if (source && source.getAudioTracks().length && typeof AudioContext !== "undefined") {
      try {
        audio = new AudioContext();
        analyser = audio.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = reduced ? 0 : 0.6;
        audio.createMediaStreamSource(source).connect(analyser);
        data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
        if (audio.state === "suspended") void audio.resume().catch(() => undefined);
      } catch { audio = null; analyser = null; data = null; }
    }
    const levels = new Float32Array(bars);
    const accent = getComputedStyle(node).getPropertyValue("--wave-accent").trim() || "#dfe61c";
    const ink = getComputedStyle(node).getPropertyValue("--wave-ink").trim() || "#141413";
    let frame = 0; let timer = 0; let stopped = false; const started = performance.now();

    const draw = (now: number) => {
      const dpr = window.devicePixelRatio || 1;
      const width = node.clientWidth, height = node.clientHeight;
      if (node.width !== width * dpr || node.height !== height * dpr) { node.width = width * dpr; node.height = height * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const t = (now - started) / 1000;
      if (analyser && data) {
        analyser.getByteFrequencyData(data);
        const usable = Math.floor(data.length * 0.6);
        for (let i = 0; i < bars; i++) {
          const from = Math.floor((i / bars) * usable), to = Math.max(from + 1, Math.floor(((i + 1) / bars) * usable));
          let sum = 0; for (let j = from; j < to; j++) sum += data[j];
          const level = Math.min(1, (sum / (to - from)) / 160);
          levels[i] = reduced ? level : levels[i] + (level - levels[i]) * 0.35;
        }
      } else {
        // No live track for this state: slow idle pulse (thinking) or a gentle synthetic wave (speaking without a remote track).
        const speed = state === "thinking" ? 0.9 : 2.2, amp = state === "thinking" ? 0.22 : 0.45;
        for (let i = 0; i < bars; i++) {
          const phase = (i / bars) * Math.PI * 2;
          const level = 0.08 + amp * (0.5 + 0.5 * Math.sin(t * speed * Math.PI + phase * 1.7)) * (0.6 + 0.4 * Math.sin(t * 0.7 + i));
          levels[i] = reduced ? 0.18 : level;
        }
      }
      const gap = size === "mini" ? 2 : 3;
      const barWidth = Math.max(2, (width - gap * (bars - 1)) / bars);
      const minHeight = size === "mini" ? 3 : 4;
      for (let i = 0; i < bars; i++) {
        const h = Math.max(minHeight, levels[i] * height);
        const x = i * (barWidth + gap), y = (height - h) / 2;
        ctx.fillStyle = state === "thinking" ? ink : accent;
        ctx.globalAlpha = state === "thinking" ? 0.28 + levels[i] * 0.4 : 0.55 + levels[i] * 0.45;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, h, barWidth / 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (stopped) return;
      if (reduced) timer = window.setTimeout(() => { frame = requestAnimationFrame(draw); }, 250);
      else frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      analyser?.disconnect();
      void audio?.close().catch(() => undefined);
    };
  }, [local, remote, state, bars, size]);

  if (state === "idle") return null;
  const label = state === "listening" ? "Слушаю — говорите" : state === "speaking" ? "Ассистент отвечает" : "Думаю";
  return <canvas ref={canvas} className={`${styles.wave} ${size === "mini" ? styles.mini : ""} ${className ?? ""}`} data-state={state} role="img" aria-label={label} />;
}
