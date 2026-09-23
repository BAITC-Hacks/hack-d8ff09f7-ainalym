import { z } from "zod";
import { listSkus } from "@/domain/skus";
import { stateVersion } from "@/db/client";

const query = z.object({ q: z.string().optional(), supplier: z.string().optional(), category: z.string().optional(), limit: z.coerce.number().int().min(1).max(500).optional() });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = query.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) return Response.json({ ok: false, code: "invalid", message: "Invalid SKU query" }, { status: 400 });
  return Response.json({ ok: true, skus: listSkus(parsed.data), state_version: stateVersion() });
}
