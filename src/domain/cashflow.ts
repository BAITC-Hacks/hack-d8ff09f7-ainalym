// Seam (L2b implements): money derived from rows only; currencies never summed.
export async function moneyView(_orgId: string): Promise<Record<string, unknown>> {
  return { cash: [], committed_by_supplier: [], next_60d: { out: [] }, stock_value: null, risks: [], empty_reason: "domain pending" };
}
