"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, ApiError, useApiSync } from "@/components/shell/api";
import { qty } from "./format";
import { ErrorState, State, type ApiErr } from "./ui";

type Target = { id: string; code_1c: string; qty_recommended: number; qty_adjusted: number | null; moq: number };
type Bound = { id: string; version: number; state: string; qty_recommended: number; qty_adjusted: number | null };
const asError = (error: unknown): ApiErr => error instanceof ApiError ? error : { status: 500, code: "unknown", message: "Не удалось сохранить. Повторите попытку." };

export function AdjustForm({ row, onClose }: { row: Target; onClose: () => void }) {
  const { refresh } = useApiSync();
  const [value, setValue] = useState(String(row.qty_adjusted ?? row.qty_recommended));
  const [reason, setReason] = useState("");
  const [bound, setBound] = useState<Bound | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "busy" | "unavailable" | "done">("loading");
  const [error, setError] = useState<ApiErr>(null);
  const [saved, setSaved] = useState(0);
  const quantity = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    controller.current?.abort();
    const next = new AbortController(); controller.current = next;
    try {
      const capability = await fetch(`/api/recommendations/${encodeURIComponent(row.id)}/adjust`, { method: "OPTIONS", signal: next.signal });
      if (capability.status === 404 || capability.status === 501) { setPhase("unavailable"); return; }
      if (!capability.ok && capability.status !== 405) throw new ApiError(capability.status, "unavailable", "Не удалось проверить сохранение. Повторите попытку.");
      const data = await apiRequest<{ recommendation?: Bound | null }>(`/api/skus/${encodeURIComponent(row.code_1c)}`, { signal: next.signal });
      if (next.signal.aborted) return;
      if (!data.recommendation || data.recommendation.id !== row.id || !["proposed", "adjusted"].includes(data.recommendation.state)) {
        throw new ApiError(409, "stale", "Рекомендация заменена или уже принята. Обновите список.");
      }
      setBound(data.recommendation); setPhase("ready");
      requestAnimationFrame(() => quantity.current?.focus());
    } catch (failure) {
      if (next.signal.aborted) return;
      setError(asError(failure)); setPhase("ready");
    }
  }, [row.id, row.code_1c]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => { void load(); });
    return () => { cancelAnimationFrame(frame); controller.current?.abort(); };
  }, [load]);
  const reload = () => { setPhase("loading"); setBound(null); setError(null); void load(); };
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!bound || phase !== "ready" || error?.status === 409) return;
    const n = Number(value);
    if (!value.trim() || !Number.isSafeInteger(n) || n < 0 || !reason.trim()) {
      setError({ status: 400, code: "invalid", message: "Укажите целое количество от 0 и причину изменения." }); return;
    }
    setPhase("busy"); setError(null);
    try {
      await apiRequest(`/api/recommendations/${encodeURIComponent(bound.id)}/adjust`, { method: "POST", body: JSON.stringify({ qty: n, reason: reason.trim(), version: bound.version }) });
      setSaved(n); setPhase("done"); refresh();
    } catch (failure) {
      const next = asError(failure); setError(next); setPhase(next?.status === 404 ? "unavailable" : "ready");
    }
  }
  if (phase === "unavailable") return <div className="oa-adjust"><State kind="unavailable" title="Изменение количества пока недоступно" onRetry={reload} retryLabel="Проверить снова">Сервис корректировки недоступен. Количество не изменено.</State><button type="button" className="oa-btn oa-btn-ghost" onClick={onClose}>Закрыть</button></div>;
  if (phase === "done") return <div className="oa-adjust"><State kind="ok" title={`Сохранено: ${qty(saved)} шт`}>Количество обновлено. Проверьте новый состав заказа перед утверждением.</State><button type="button" className="oa-btn oa-btn-outline" onClick={onClose}>Готово</button></div>;
  return <form className="oa-adjust" onSubmit={submit} aria-label={`Изменить количество ${row.code_1c}`} aria-busy={phase === "loading" || phase === "busy"}>
    <label className="oa-field qty">Количество, шт<input ref={quantity} type="number" inputMode="numeric" min="0" step="1" required value={value} onChange={event => setValue(event.target.value)} disabled={phase === "busy"} /></label>
    <label className="oa-field reason">Причина (обязательно)<input required maxLength={500} value={reason} onChange={event => setReason(event.target.value)} placeholder="Например: клиент перенёс заказ" disabled={phase === "busy"} /></label>
    <button type="submit" className="oa-btn oa-btn-black" disabled={phase !== "ready" || !bound || error?.status === 409}>{phase === "busy" ? "Сохраняю…" : phase === "loading" ? "Проверяю…" : "Сохранить"}</button>
    <button type="button" className="oa-btn oa-btn-ghost" disabled={phase === "busy"} onClick={onClose}>Отмена <span className="oa-kbd" aria-hidden>Esc</span></button>
    <span className="muted oa-form-note">{bound ? `В заказе сейчас ${qty(bound.qty_adjusted ?? bound.qty_recommended)} шт. ` : ""}Кратность: {row.moq}. Ноль исключает товар из заказа.{value && Number(value) % row.moq !== 0 ? " Количество не кратно упаковке." : ""}</span>
    {error ? <ErrorState error={error} onRetry={() => { refresh(); reload(); }} /> : null}
  </form>;
}

/** Capability checks make an absent adjustment route visible before presenting an editor. */
export function useAdjustmentAvailability(id?: string) {
  const [snapshot, setSnapshot] = useState<{ id?: string; available: boolean | null }>({ available: null });
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    fetch(`/api/recommendations/${encodeURIComponent(id)}/adjust`, { method: "OPTIONS", signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setSnapshot({ id, available: response.ok || response.status === 405 }); })
      .catch(() => { if (!controller.signal.aborted) setSnapshot({ id, available: false }); });
    return () => controller.abort();
  }, [id]);
  return snapshot.id === id ? snapshot.available : null;
}
