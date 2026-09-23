import { z } from "zod";
import { decideProposal } from "../../../domain/apply";

const bodySchema = z.object({
  proposal_version: z.number().int().positive(),
  adjustments: z.array(z.object({ code_1c: z.string().min(1), qty: z.number().int().nonnegative() })).optional(),
}).strict();

export async function handleDecision(request: Request, id: string, decision: "approve" | "reject") {
  let body: z.infer<typeof bodySchema>;
  try { body = bodySchema.parse(await request.json()); }
  catch { return Response.json({ ok: false, code: "invalid", message: "Invalid decision body" }, { status: 400 }); }
  try {
    const result = await decideProposal(id, body.proposal_version, decision, body.adjustments);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const status = error instanceof Error && "status" in error ? error.status as number : error instanceof RangeError ? 422 : 500;
    return Response.json({ ok: false, code: status === 409 ? "stale" : status === 404 ? "not_found" : status === 422 ? "business_rejection" : "internal", message: error instanceof Error ? error.message : "Unknown error" }, { status });
  }
}
