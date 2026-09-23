/** Tiny pending-work counter shared by the fetch wrapper and the shell's loading ribbon (no React here). */
let pending = 0; let navigating = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
export function beginPending() { pending++; emit(); }
export function endPending() { pending = Math.max(0, pending - 1); emit(); }
export function setNavigating(value: boolean) { if (navigating !== value) { navigating = value; emit(); } }
export function isBusy() { return pending > 0 || navigating; }
export function subscribeBusy(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
