"use client";
import { useEffect, useRef } from "react";

/** Store only view state. Server data and approval versions never enter this cache. */
export function usePagePosition(ready: boolean) {
  const restored = useRef(false);
  useEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    const key = `oa:scroll:${location.pathname}${location.search}`;
    const y = Number(sessionStorage.getItem(key) ?? 0);
    let frame = requestAnimationFrame(() => window.scrollTo(0, y));
    const save = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => sessionStorage.setItem(key, String(window.scrollY)));
    };
    window.addEventListener("scroll", save, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", save); };
  }, [ready]);
}

export function skuHref(code: string) {
  const from = typeof window === "undefined" ? "/opus_a/replenishment" : location.pathname + location.search;
  return `/opus_a/skus/${encodeURIComponent(code)}?from=${encodeURIComponent(from)}`;
}

export function safeReturnPath(value: string | null | undefined, fallback: string) {
  return value && /^\/opus_a\/(today|replenishment)(\?|$)/.test(value) ? value : fallback;
}
