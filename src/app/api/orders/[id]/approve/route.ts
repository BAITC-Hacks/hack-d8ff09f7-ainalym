import { z } from "zod";
import { approveOrder } from "@/domain/orders";
import { stateVersion } from "@/db/client";

const body = z.object({ version: z.number().int().positive() }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let input: z.infer<typeof body>;
  try {
    input = body.parse(await request.json());
  } catch {
    return Response.json({ ok: false, code: "invalid", message: "Expected an order version", field: "version" }, { status: 400 });
  }
  const { id } = await params;
  try {
    const order = approveOrder(id, input.version);
    return Response.json({ ok: true, order, state_version: stateVersion() });
  } catch (error) {
    const code = error instanceof Error ? error.message : "order_rejected";
    const status = code === "order_not_found" ? 404 : code === "stale_order_version" ? 409 : 422;
    return Response.json({ ok: false, code, message: code }, { status });
  }
}
