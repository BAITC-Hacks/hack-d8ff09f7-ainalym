import { basename } from "node:path";
import { db } from "@/db/client";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";

/** Read-only: partner files and in-transit purchase orders exactly as the ETL recorded them (no hardcoded list). */
type FileRow = { path: string; rows: number; since: string | null; until: string | null };
const fileDate = (name: string): string | null => {
  const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(name);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const supplierOf = (path: string): string | null => /\/(IEK|SE)\//.exec(path)?.[1] ?? null;

export async function GET(): Promise<Response> {
  return handle(() => {
    const d = db();
    const org = d.prepare("SELECT payload FROM organization WHERE id = 'partner'").get() as { payload: string } | undefined;
    const loadedAt = org ? (JSON.parse(org.payload) as { etl_fetched_at?: string }).etl_fetched_at ?? null : null;
    const sales = d.prepare("SELECT source AS path, COUNT(*) AS rows, MIN(at) AS since, MAX(at) AS until FROM sales_line GROUP BY source ORDER BY source").all() as FileRow[];
    const transitFiles = d.prepare("SELECT source_file AS path, COUNT(*) AS rows, NULL AS since, NULL AS until FROM in_transit GROUP BY source_file ORDER BY source_file").all() as FileRow[];
    const files = [
      ...sales.map(f => ({ kind: "sales" as const, ...f })),
      ...transitFiles.map(f => ({ kind: "transit" as const, ...f })),
    ].filter(f => f.path).map(f => ({
      kind: f.kind, name: basename(f.path), supplier_id: supplierOf(f.path), rows: f.rows,
      data_since: f.since ? f.since.slice(0, 10) : null, data_until: f.until ? f.until.slice(0, 10) : null,
      file_date: fileDate(basename(f.path)), loaded_at: loadedAt,
    }));
    const transit = (d.prepare(`SELECT t.po_ref, s.supplier_id, t.expected_at, t.source_file, COUNT(*) AS lines, SUM(CAST(t.qty AS REAL)) AS qty
      FROM in_transit t JOIN sku s ON s.code_1c = t.code_1c GROUP BY t.po_ref, s.supplier_id, t.source_file ORDER BY s.supplier_id, t.po_ref`).all() as
      { po_ref: string; supplier_id: string; expected_at: string | null; source_file: string; lines: number; qty: number }[])
      .map(t => ({ ...t, source_file: basename(t.source_file), file_date: fileDate(basename(t.source_file)) }));
    return ok({ loaded_at: loadedAt, files, transit, provenance: "partner_anonymised", ai: "rules", external: "export_only" });
  });
}
