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
  const [snapshot, setSnapshot] = useState<{ path: string; data?: T; error: ApiError | null; loading: boolean }>({ path, data: initial, error: null, loading: initial === undefined });
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt(n => n + 1), []);
  const generation = useRef(0);
  useEffect(() => {
    let disposed = false; let timer: ReturnType<typeof setTimeout>; let backoff = 2000;
    let controller: AbortController | undefined;
    const load = async () => {
      clearTimeout(timer);
      if (disposed || document.hidden) return;
      controller?.abort(); controller = new AbortController(); const signal = controller.signal;
      const request = ++generation.current;
      try {
        const value = await apiRequest<T>(path, { signal });
        if (disposed || signal.aborted || request !== generation.current) return;
        setSnapshot({ path, data: value, error: null, loading: false }); reportNetwork(false); backoff = 2000;
      } catch (failure) {
        if (disposed || signal.aborted || request !== generation.current) return;
        const error = failure instanceof ApiError ? failure : new ApiError(500, "unknown", "Не удалось загрузить данные.");
        setSnapshot(previous => ({ path, data: previous.path === path ? previous.data : undefined, error, loading: false }));
        if (error.status === 0) reportNetwork(true);
        timer = setTimeout(load, backoff); backoff = Math.min(backoff * 2, 30000);
      }
    };
    const visible = () => { if (document.hidden) { clearTimeout(timer); controller?.abort(); } else void load(); };
    document.addEventListener("visibilitychange", visible); void load();
    return () => { disposed = true; clearTimeout(timer); controller?.abort(); document.removeEventListener("visibilitychange", visible); };
  }, [path, revision, attempt, reportNetwork]);
  // A changed URL never exposes the previous object's response as the new object.
  return snapshot.path === path ? { ...snapshot, reload } : { data: undefined, error: null, loading: true, reload };
}
