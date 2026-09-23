"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
/** Keep an API region mounted while its controls own focus. New records stay in an explicit pending snapshot. */
export function useFocusSnapshot<T>(incoming: T, region: RefObject<HTMLElement | null>) {
  const [shown, setShown] = useState(incoming); const [pending, setPending] = useState(false);
  const latest = useRef(incoming); const shownRef = useRef(incoming);
  useEffect(() => {
    let cancelled = false; latest.current = incoming;
    queueMicrotask(() => {
      if (cancelled) return;
      if (JSON.stringify(shownRef.current) === JSON.stringify(incoming)) { setPending(false); return; }
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused !== region.current && region.current?.contains(focused)) { setPending(true); return; }
      shownRef.current = incoming; setShown(incoming); setPending(false);
    });
    return () => { cancelled = true; };
  }, [incoming, region]);
  useEffect(() => {
    const root = region.current;
    const settle = () => queueMicrotask(() => {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused !== root && root?.contains(focused)) return;
      shownRef.current = latest.current; setShown(latest.current); setPending(false);
    });
    root?.addEventListener("focusout", settle); return () => root?.removeEventListener("focusout", settle);
  }, [region]);
  function apply() {
    shownRef.current = latest.current; setShown(latest.current); setPending(false);
    requestAnimationFrame(() => region.current?.focus({ preventScroll: true }));
  }
  return { shown, pending, apply };
}
