"use client";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isBusy, setNavigating, subscribeBusy } from "@/components/shell/pending";
import styles from "./loading.module.css";

const SHOW_AFTER_MS = 300;
/** Thin indeterminate ribbon under the header: shows for route transitions and any page-level request longer than ~300 ms. */
export function LoadRibbon() {
  const busy = useSyncExternalStore(subscribeBusy, isBusy, () => false);
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  useEffect(() => { setNavigating(false); }, [pathname]);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download") || anchor.origin !== location.origin) return;
      if (anchor.pathname === location.pathname) return; // same page, only the query changes — the request counter covers it
      setNavigating(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  useEffect(() => {
    if (!busy) { setVisible(false); return; }
    const show = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    const safety = setTimeout(() => setNavigating(false), 10000);
    return () => { clearTimeout(show); clearTimeout(safety); };
  }, [busy]);
  return <div className={styles.ribbon} data-active={visible || undefined} role="progressbar" aria-label="Загрузка" aria-hidden={!visible} aria-valuetext={visible ? "Загружаю" : undefined}><i /></div>;
}
/** Circular loader (an <i> so skeleton `span` rules never restyle it). */
export function Spinner({ size = 16, label }: { size?: number; label?: string }) {
  return <i className={styles.spinner} style={{ width: size, height: size }} role={label ? "status" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}
export function SectionLoading({ label = "Загружаю данные…", children }: { label?: string; children?: ReactNode }) {
  return <div className={styles.section} role="status" aria-live="polite"><Spinner size={18} /><span>{label}</span>{children}</div>;
}
