"use client";
import { useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { apiRequest, ApiError, useApi, useApiSync } from "@/components/shell/api";
import { clock, qty } from "./format";
import { ErrorState, State, type ApiErr } from "./ui";

type Run = { id: string; scope: { supplier?: string }; started_at: string; finished_at: string | null; skus: number; recommended: number };
export function RunHistory({ supplier }: { supplier?: string }) {
  const runs = useApi<{ runs: Run[] }>("/api/calc/runs");
  const { refresh } = useApiSync();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<ApiErr>(null);
  const [done, setDone] = useState("");
  const matching = runs.data?.runs.filter(run => !supplier || !run.scope.supplier || run.scope.supplier === supplier) ?? [];
  async function recalculate() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null); setDone("");
    try {
      const result = await apiRequest<{ recommended: number }>("/api/calc/run", { method: "POST", body: JSON.stringify({ scope: {} }) });
      setDone(`Расчёт готов: ${qty(result.recommended)} рекомендаций.`); refresh();
    } catch (failure) { setError(failure instanceof ApiError ? failure : { status: 500, code: "unknown", message: "Расчёт не завершён. Повторите попытку." }); }
    finally { setBusy(false); lock.current = false; }
  }
  return <div className="oa-run">
    <div className="oa-run-line"><span className="muted">{matching[0] ? <>Последний расчёт: <time dateTime={matching[0].finished_at ?? matching[0].started_at}>{clock(matching[0].finished_at ?? matching[0].started_at)}</time></> : runs.loading ? "Проверяю дату расчёта…" : "Расчётов пока нет"}</span>
      <button className="oa-btn oa-btn-outline oa-btn-sm" onClick={recalculate} disabled={busy}><RefreshCw size={14} aria-hidden />{busy ? "Считаю…" : "Пересчитать всё"}</button>
      {matching.length > 0 ? <details className="oa-run-history"><summary>История расчётов</summary><ol>{matching.slice(0, 5).map(run => <li key={run.id}><time dateTime={run.started_at}>{clock(run.started_at)}</time><span>{run.scope.supplier ?? "Все поставщики"} · {qty(run.recommended)} рекомендаций{!run.finished_at ? " · не завершён" : ""}</span></li>)}</ol></details> : null}
    </div>
    {error || runs.error ? <ErrorState error={error ?? runs.error} onRetry={error ? recalculate : runs.reload} /> : null}
    {done ? <State kind="ok" title={done} /> : null}
  </div>;
}
