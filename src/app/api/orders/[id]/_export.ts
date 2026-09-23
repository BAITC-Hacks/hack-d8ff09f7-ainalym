import { readFileSync } from "node:fs";
import { db } from "@/db/client";
import { deliverOrder } from "@/peers/deliver";
import { exportDownloadDisposition } from "@/peers/onec_export";

export async function exportResponse(id: string, format: "csv" | "xlsx"): Promise<Response> {
  const result = await deliverOrder(id);
  if (result.state !== "exported" || !result.path) {
    const code = result.reason || "export_failed";
    const status = code === "unknown_po" ? 404 : code === "purchase_order_not_approved" ? 422 : 503;
    return Response.json({ ok: false, code, message: code }, { status });
  }
  let path = result.path;
  if (format === "csv") {
    const peer = db().prepare("SELECT payload FROM ledger_peer_record WHERE peer='onec_export' AND external_identity=?").get(id) as { payload: string } | undefined;
    const paths = peer ? JSON.parse(peer.payload) as { csv_path?: string } : null;
    if (!paths?.csv_path) return Response.json({ ok: false, code: "export_file_missing", message: "CSV export missing" }, { status: 503 });
    path = paths.csv_path;
  }
  try {
    const data = readFileSync(path);
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": format === "csv" ? "text/csv; charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": exportDownloadDisposition(id, format),
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json({ ok: false, code: "export_file_missing", message: "Export file missing" }, { status: 503 });
  }
}
