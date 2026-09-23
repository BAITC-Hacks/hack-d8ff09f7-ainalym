// Seam (L2a implements todayView/queueView/ordersView; L2b implements moneyView/skuView in their own files).
export { moneyView } from "./cashflow";
export { skuView } from "./skus";
export async function todayView(_orgId: string): Promise<Record<string, unknown>> {
  return { lead: "", decision: null, queue_count: 0, pulse: null, commitments: [], background: [], feed_next: [], empty_reason: "domain pending" };
}
export async function queueView(_orgId: string): Promise<{ items: unknown[]; empty_reason?: string }> {
  return { items: [], empty_reason: "domain pending" };
}
export async function ordersView(_orgId: string): Promise<{ orders: unknown[]; empty_reason?: string }> {
  return { orders: [], empty_reason: "domain pending" };
}
