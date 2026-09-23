import { readFileSync } from "node:fs";
import { exportDownloadDisposition, exportOrder } from "@/peers/onec_export";
import { worldResponseError } from "@/world/http";
import { WorldError } from "@/world/feed";

export const runtime = "nodejs";
type Context = { params: Promise<{ po_id: string }> };

export async function POST(_request: Request, { params }: Context) {
  try { return Response.json({ ok: true, ...exportOrder((await params).po_id) }); }
  catch (error) { return worldResponseError(error); }
}

export async function GET(request: Request, { params }: Context) {
  try {
    const format = new URL(request.url).searchParams.get("format") ?? "xlsx";
    if (format !== "xlsx" && format !== "csv") throw new WorldError("invalid_format", 400);
    const poId = (await params).po_id;
    const result = exportOrder(poId);
    const path = format === "csv" ? result.csv_path : result.xlsx_path;
    return new Response(readFileSync(path), {
      headers: {
        "content-type": format === "csv" ? "text/csv; charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": exportDownloadDisposition(poId, format),
        "x-ainalym-external": "export_only",
      },
    });
  } catch (error) { return worldResponseError(error); }
}
