import { todayView, moneyView } from "@/domain/views";
import { agentStats } from "@/server/ledger";
import { orgId } from "@/server/context";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";
export async function GET(): Promise<Response> {
  return handle(async () => {
    const org = orgId();
    const [today, money] = await Promise.all([todayView(org), moneyView(org)]);
    const pulse = today.pulse && typeof today.pulse === "object" ? today.pulse as Record<string, unknown> : {};
    return ok({ ...today, pulse: { ...pulse, money: pulse.money || money, stockout_risk: pulse.stockout_risk || { count: 0, top: [] }, agents: agentStats(org) } });
  });
}
