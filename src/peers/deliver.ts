// Seam (L6 implements): the 1С-compatible export file for an approved purchase order (export_only, never a connection).
export interface DeliverResult { state: "exported" | "delivery_failed"; path?: string; reason?: string }
export async function deliverOrder(_po: unknown): Promise<DeliverResult> {
  return { state: "delivery_failed", reason: "peer pending" };
}
