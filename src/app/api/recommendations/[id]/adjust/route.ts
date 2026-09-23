import { z } from "zod";
import { db, stateVersion } from "@/db/client";
import { adjustRecommendation, ProposalConflictError, ProposalNotFoundError } from "@/domain/apply";
import { body, handle, ok, truthAxes } from "@/server/http";
import { recommendationById } from "@/server/recommendations";

export const runtime = "nodejs";

const AdjustBody = z.object({
  qty: z.number().int().nonnegative().safe(),
  reason: z.string().trim().min(1).max(200),
  version: z.number().int().safe(),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const id = (await params).id;
    const input = await body(request, AdjustBody);
    try {
      const result = await adjustRecommendation(id, input.qty, input.reason, input.version);
      return ok({ recommendation: recommendationById(id), proposal: { id: result.proposal_id, version: result.proposal_version } });
    } catch (error) {
      if (error instanceof ProposalConflictError) {
        const current = db().prepare("SELECT version FROM recommendation WHERE id=?").get(id) as { version: number } | undefined;
        return Response.json({ ok: false, code: "stale_version", current_version: current?.version ?? null,
          ...truthAxes(), state_version: stateVersion() }, { status: 409 });
      }
      if (error instanceof ProposalNotFoundError) return Response.json({ ok: false, code: "not_found", ...truthAxes(), state_version: stateVersion() }, { status: 404 });
      throw error;
    }
  });
}
