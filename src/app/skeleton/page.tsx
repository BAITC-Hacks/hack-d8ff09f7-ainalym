import { db } from "@/db/client";
import { GET as healthRoute } from "@/app/api/health/route";
import { GET as todayRoute } from "@/app/api/today/route";

export const dynamic = "force-dynamic";

export default async function SkeletonPage() {
  const organization = db().prepare("SELECT name FROM organization LIMIT 1").get() as { name: string } | undefined;
  const [healthResponse, todayResponse] = await Promise.all([healthRoute(), todayRoute()]);
  const health = await healthResponse.json() as { mode?: "live" | "offline"; ai_provider?: string };
  const today = await todayResponse.json() as { queue_count?: number; commitments?: unknown[]; background?: unknown[]; pulse?: { agents?: { auto: number; needs_you: number } } };
  return <main style={{ padding: 24 }}>
    <h1>Ainalym · skeleton</h1>
    <p>Организация: {organization?.name || "Демо-данные ещё не загружены"}</p>
    <p role="status">{health.mode === "offline" ? "Офлайн-режим: ключи не настроены" : health.mode === "live" ? `Онлайн-режим · ${health.ai_provider}` : "Режим недоступен"}</p>
    <dl>
      <dt>Решения в очереди</dt><dd>{today.queue_count ?? 0}</dd>
      <dt>Обязательства</dt><dd>{today.commitments?.length ?? 0}</dd>
      <dt>Фоновые события</dt><dd>{today.background?.length ?? 0}</dd>
      <dt>Действия агентов</dt><dd>{today.pulse?.agents?.auto ?? 0}</dd>
      <dt>Требуют вас</dt><dd>{today.pulse?.agents?.needs_you ?? 0}</dd>
    </dl>
  </main>;
}
