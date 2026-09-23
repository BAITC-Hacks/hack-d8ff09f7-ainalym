import { z } from "zod";
import { stateVersion } from "@/db/client";
import { DraftProviderUnavailable, prepareRunSummary, prepareSupplierEmail } from "@/ai/drafting";

const Body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("supplier_email"), po_id: z.string().min(1) }),
  z.object({ kind: z.literal("run_summary"), run_id: z.string().min(1) }),
]);

export async function POST(request: Request): Promise<Response> {
  let body: z.infer<typeof Body>;
  try { body = Body.parse(await request.json()); }
  catch { return Response.json({ ok: false, code: "invalid", message: "Invalid draft request" }, { status: 400 }); }
  try {
    const artifact = body.kind === "supplier_email" ? await prepareSupplierEmail(body.po_id) : await prepareRunSummary(body.run_id);
    return Response.json({ ok: true, artifact, state_version: stateVersion() });
  } catch (error) {
    if (error instanceof DraftProviderUnavailable) return Response.json({ ok: false, code: "provider_unavailable", message: "Provider unavailable" }, { status: 503 });
    const code = error instanceof Error ? error.message : "draft_failed";
    const status = code.endsWith("not_found") ? 404 : code === "purchase_order_not_approved" || code === "purchase_order_empty" ? 422 : 500;
    return Response.json({ ok: false, code, message: "Draft could not be prepared" }, { status });
  }
}
