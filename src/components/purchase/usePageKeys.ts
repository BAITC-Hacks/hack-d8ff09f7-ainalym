"use client";
import { useEffect } from "react";

/** Focus only: a shortcut never approves or submits an operation. */
export function usePageKeys() {
  useEffect(() => {
    const focusAction = (event: KeyboardEvent) => {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.defaultPrevented
      )
        return;
      if (
        (event.target as HTMLElement).closest(
          "input, textarea, select, [contenteditable=true], dialog[open]",
        )
      )
        return;
      const target = document.querySelector<HTMLElement>(
        `[data-page-key="${event.key.toLowerCase().replace(/[^a-z]/g, "")}"]`,
      );
      if (!target) return;
      event.preventDefault();
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "nearest", behavior: "instant" });
    };
    document.addEventListener("keydown", focusAction);
    return () => document.removeEventListener("keydown", focusAction);
  }, []);
}
