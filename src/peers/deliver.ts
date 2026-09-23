// L2 calls this seam after human approval. It reads the persisted PO and writes a local file only.
import { exportOrder } from "./onec_export";

export interface DeliverResult { state: "exported" | "delivery_failed"; path?: string; peer_record_id?: string; reason?: string; provenance: "partner_anonymised"; ai: "none"; external: "export_only" }
export async function deliverOrder(po: unknown): Promise<DeliverResult> {
  const id = typeof po === "string" ? po : po && typeof po === "object" && "id" in po ? (po as { id: unknown }).id : null;
  const axes = { provenance: "partner_anonymised", ai: "none", external: "export_only" } as const;
  if (typeof id !== "string" || !id) return { state: "delivery_failed", reason: "invalid_po", ...axes };
  try {
    const result = exportOrder(id);
    return { state: "exported", path: result.xlsx_path, peer_record_id: result.peer_record_id, ...axes };
  } catch (error) {
    return { state: "delivery_failed", reason: error instanceof Error ? error.message : "export_failed", ...axes };
  }
}
