"use client";
import { useSyncExternalStore } from "react";
const key = "ainalym:rail";
function readCollapsed() { try { return localStorage.getItem(key) === "true"; } catch { return false; } }
function subscribe(onChange: () => void) { window.addEventListener("storage", onChange); window.addEventListener("ainalym:rail", onChange); return () => { window.removeEventListener("storage", onChange); window.removeEventListener("ainalym:rail", onChange); }; }
export function useRailCollapsed() { return useSyncExternalStore(subscribe, readCollapsed, () => false); }
export function toggleRail() { try { localStorage.setItem(key, String(!readCollapsed())); window.dispatchEvent(new Event("ainalym:rail")); } catch { /* Navigation remains available when preferences cannot be saved. */ } }
