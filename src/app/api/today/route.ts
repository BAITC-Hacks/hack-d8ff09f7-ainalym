import { todayView, moneyView } from "@/domain/views";
import { db } from "@/db/client";
import { agentStats } from "@/server/ledger";
import { orgId } from "@/server/context";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";
export async function GET(): Promise<Response> {
  return handle(async () => {
    const org = orgId();
    const [today, money] = await Promise.all([todayView(org), moneyView(org)]);
    const pulse = today.pulse && typeof today.pulse === "object" ? today.pulse as Record<string, unknown> : {};
    const queueCount = (db().prepare("SELECT COUNT(*) AS n FROM proposal WHERE state='needs_review'").get() as { n: number }).n;
    const lastRun = db().prepare("SELECT id,skus,recommended,started_at FROM calc_run ORDER BY started_at DESC LIMIT 1").get() as { id: string; skus: number; recommended: number; started_at: string } | undefined;
    const pending = db().prepare("SELECT id,kind,subject_id,rationale_ru,created_at FROM proposal WHERE state='needs_review' ORDER BY created_at DESC LIMIT 1").get();
    const riskRows = db().prepare(`SELECT r.code_1c,s.name,r.urgency,r.components,sup.lead_time_days FROM recommendation r
      JOIN sku s ON s.code_1c=r.code_1c JOIN supplier sup ON sup.id=r.supplier_id
      WHERE r.run_id=? AND r.urgency IN ('critical','soon') AND r.qty_recommended>0 ORDER BY r.urgency,r.qty_recommended DESC LIMIT 5`).all(lastRun?.id || "");
    const riskCount = (db().prepare("SELECT COUNT(*) AS n FROM recommendation WHERE run_id=? AND urgency IN ('critical','soon') AND qty_recommended>0").get(lastRun?.id || "") as { n: number }).n;
    const risk = { count: riskCount, top: riskRows.map(row => ({ code_1c: row.code_1c, name: row.name,
      days_of_cover: JSON.parse(String(row.components)).days_of_cover ?? null, lead_time_days: row.lead_time_days })) };
    const commitments = db().prepare("SELECT id,kind,subject_id,state,created_at FROM proposal ORDER BY created_at DESC LIMIT 8").all()
      .map(row => ({ id: row.id, kind: row.kind, title: String(row.subject_id), next_event: row.created_at,
        owner: "purchasing_manager", state: row.state }));
    const background = Array.isArray(today.background) && today.background.length ? today.background : db().prepare("SELECT id,kind,summary_ru,at FROM agent_action WHERE org_id=? ORDER BY at DESC LIMIT 5").all(org);
    const feed_next = Array.isArray(today.feed_next) && today.feed_next.length ? today.feed_next : db().prepare("SELECT id,kind,at FROM world_event WHERE org_id=? AND state='scripted' ORDER BY seq LIMIT 3").all(org);
    return ok({ ...today, lead: today.lead || (lastRun ? `Рекомендаций к заказу: ${lastRun.recommended}` : ""),
      decision: today.decision || pending || null, queue_count: Number(today.queue_count) || queueCount,
      commitments, background, feed_next,
      pulse: { ...pulse, money: pulse.money || money, stockout_risk: pulse.stockout_risk || risk, agents: agentStats(org) },
      pending_reason: today.pending_reason || (commitments.length ? undefined : "Нет предложений, ожидающих решения") });
  });
}
