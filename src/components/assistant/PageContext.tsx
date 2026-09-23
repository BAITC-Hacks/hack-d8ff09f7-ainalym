"use client";
import { useEffect } from "react";

/** Publishes the page's business context for the assistant as `data-ainalym-context` on <main>. Renders nothing. */
export function PageContext({ value }: { value: Record<string, unknown> }) {
  const json = JSON.stringify(value);
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    main.setAttribute("data-ainalym-context", json);
    window.dispatchEvent(new CustomEvent("ainalym:context"));
    return () => { if (main.getAttribute("data-ainalym-context") === json) { main.removeAttribute("data-ainalym-context"); window.dispatchEvent(new CustomEvent("ainalym:context")); } };
  }, [json]);
  return null;
}
