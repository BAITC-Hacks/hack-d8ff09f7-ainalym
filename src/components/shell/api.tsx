"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); this.name = "ApiError"; }
}
export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(path, { cache: "no-store", ...init, headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } }); }
  catch (error) { if (error instanceof DOMException && error.name === "AbortError") throw error; throw new ApiError(0, "network", "Нет связи — показываю последнее"); }
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.ok === false) throw new ApiError(response.status, body?.code ?? "unavailable", body?.message ?? (response.status === 404 ? "Этот раздел API пока недоступен." : "Не удалось получить данные. Попробуйте ещё раз."));
  if (body === null) throw new ApiError(502, "invalid_response", "Сервис вернул ответ без данных.");
  return body as T;
}
const SyncContext = createContext<{ revision: number; offline: boolean; syncError: string; refresh: () => void; reportNetwork: (failed: boolean) => void }>({ revision: 0, offline: false, syncError: "", refresh: () => {}, reportNetwork: () => {} });
export function ApiProvider({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState(0);
  const [offline, setOffline] = useState(false);
  const [syncError, setSyncError] = useState("");
  const refresh = useCallback(() => setRevision(n => n + 1), []);
  const reportNetwork = useCallback((failed: boolean) => setOffline(failed || !navigator.onLine), []);
  useEffect(() => {
    let disposed = false, fingerprint: string | undefined, timer: ReturnType<typeof setTimeout>;
    let backoff = 2000; let controller: AbortController | undefined;
    const poll = async () => {
      clearTimeout(timer);
      if (disposed || document.hidden) return;
      controller?.abort(); controller = new AbortController();
      try {
        const state = await apiRequest<{ fingerprint?: string; state_version: number }>("/api/state", { signal: controller.signal });
        if (disposed) return;
        const next = state.fingerprint ?? String(state.state_version);
        if (fingerprint !== undefined && next !== fingerprint) refresh();
        fingerprint = next; setOffline(false); setSyncError(""); backoff = 2000;
        timer = setTimeout(poll, 5000);
      } catch (error) {
        if (disposed || (error instanceof DOMException && error.name === "AbortError")) return;
        setOffline(!navigator.onLine || (error instanceof ApiError && error.status === 0));
        setSyncError("Обновления временно недоступны — показываю последнее");
        timer = setTimeout(poll, backoff); backoff = Math.min(backoff * 2, 30000);
      }
    };
    const resume = () => { if (!document.hidden) { refresh(); void poll(); } else { clearTimeout(timer); controller?.abort(); } };
    const disconnected = () => setOffline(true);
    document.addEventListener("visibilitychange", resume); window.addEventListener("online", resume); window.addEventListener("offline", disconnected);
    void poll();
    return () => { disposed = true; clearTimeout(timer); controller?.abort(); document.removeEventListener("visibilitychange", resume); window.removeEventListener("online", resume); window.removeEventListener("offline", disconnected); };
  }, [refresh]);
  return <SyncContext.Provider value={{ revision, offline, syncError, refresh, reportNetwork }}>{children}</SyncContext.Provider>;
}
export const useApiSync = () => useContext(SyncContext);
export function useApi<T>(path: string, initial?: T) {
  const { revision, reportNetwork } = useApiSync();
  const [data, setData] = useState<T | undefined>(initial);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(initial === undefined);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt(n => n + 1), []);
  const generation = useRef(0);
  useEffect(() => {
    const controller = new AbortController(); const request = ++generation.current;
    const load = async () => {
      try { const value = await apiRequest<T>(path, { signal: controller.signal }); if (request !== generation.current) return; setData(value); setError(null); reportNetwork(false); }
      catch (failure) { if (controller.signal.aborted) return; const e = failure instanceof ApiError ? failure : new ApiError(500, "unknown", "Не удалось загрузить данные."); setError(e); if (e.status === 0) reportNetwork(true); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void load(); return () => controller.abort();
  }, [path, revision, attempt, reportNetwork]);
  return { data, error, loading, reload };
}
