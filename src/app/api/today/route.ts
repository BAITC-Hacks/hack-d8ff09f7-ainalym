import { todayView } from "@/domain/views";
import { db } from "@/db/client";
import { agentStats } from "@/server/ledger";
import { orgId } from "@/server/context";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";
export async function GET(): Promise<Response> {
  return handle(async () => {
    const org = orgId();
    const today = await todayView(org);
    const pulse = today.pulse && typeof today.pulse === "object" ? today.pulse as Record<string, unknown> : {};
    const lastRun = db().prepare("SELECT id,skus,recommended,started_at FROM calc_run WHERE org_id=? OR org_id IS NULL ORDER BY started_at DESC,rowid DESC LIMIT 1").get(org) as { id: string; skus: number; recommended: number; started_at: string } | undefined;
    // Обязательства = утверждённые/выгруженные заказы поставщикам — те же строки, что считает /money (moneyView).
    const commitments = db().prepare("SELECT id,kind,subject_id,state,created_at FROM proposal WHERE kind='supplier_order' AND state IN ('approved','exported') AND (org_id=? OR org_id IS NULL) ORDER BY created_at DESC,rowid DESC LIMIT 8").all(org)
      .map(row => ({ id: row.id, kind: row.kind, title: `Заказ поставщику ${String(row.subject_id)}`, next_event: row.created_at,
        owner: "purchasing_manager", state: row.state }));
    const background = Array.isArray(today.background) && today.background.length ? today.background : db().prepare("SELECT id,kind,summary_ru,at FROM agent_action WHERE org_id=? ORDER BY at DESC LIMIT 5").all(org);
    const feed_next = Array.isArray(today.feed_next) && today.feed_next.length ? today.feed_next : db().prepare("SELECT id,kind,at FROM world_event WHERE org_id=? AND state='scripted' ORDER BY seq LIMIT 3").all(org);
    return ok({ ...today, lead: today.lead || (lastRun ? `Рекомендаций к заказу: ${lastRun.recommended}` : ""),
      decision: today.decision || null, queue_count: Number(today.queue_count) || 0,
      commitments, background, feed_next,
      pulse: { ...pulse, agents: agentStats(org) },
      pending_reason: today.pending_reason || (Number(today.queue_count) ? undefined : "Нет предложений, ожидающих решения") });
  });
}
