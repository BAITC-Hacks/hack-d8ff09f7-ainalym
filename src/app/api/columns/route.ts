import { buildSemanticColumn } from "@/ai/columns";
import { z } from "zod";

const RequestBody = z.object({
  header: z.string().trim().min(1).max(120),
  code_1c: z.array(z.string().min(1).max(100)).min(1).max(25),
});

export async function POST(request: Request): Promise<Response> {
  let body: z.infer<typeof RequestBody>;
  try { body = RequestBody.parse(await request.json()); }
  catch { return Response.json({ ok: false, code: "invalid", message: "Invalid column request" }, { status: 400 }); }
  try {
    const column = await buildSemanticColumn(body.header, body.code_1c);
    if (column.result_state === "provider_error") {
      return Response.json({ ok: false, code: "provider_unavailable", column }, { status: 503 });
    }
    return Response.json({ ok: true, column });
  } catch {
    return Response.json({ ok: false, code: "column_failed", message: "Column could not be prepared" }, { status: 500 });
  }
}
