import { randomUUID } from "node:crypto";
import { z } from "zod";
import { bumpStateVersion, db, withTx } from "@/db/client";
import { body, handle, HttpError, ok } from "@/server/http";

export const runtime = "nodejs";
const UpdateSchema = z.object({ supplier_id: z.enum(["IEK", "SE"]), lead_time_days: z.number().int().positive().optional(), review_days: z.number().int().positive().optional(), service_level: z.number().min(0.5).max(0.999).optional(), growth_cap: z.number().min(0).max(1).optional() });

export async function GET(): Promise<Response> {
  return handle(() => ok({ suppliers: db().prepare("SELECT id,lead_time_days,review_days,terms,currency,version FROM supplier ORDER BY id").all().map(row => ({ ...row, terms: JSON.parse(String(row.terms)) })), defaults: { service_level: 0.9, growth_cap: 0.5, outlier: { k_month: 3, k_doc: 5, min_units: 20 } } }));
}

export async function PUT(request: Request): Promise<Response> {
  return handle(async () => {
    const change = await body(request, UpdateSchema);
    if (Object.keys(change).length === 1) throw new HttpError(400, "empty_change", "No parameter changed");
    const supplier = db().prepare("SELECT * FROM supplier WHERE id = ?").get(change.supplier_id) as { version: number } | undefined;
    if (!supplier) throw new HttpError(404, "not_found", "Supplier not found");
    const id = `PR-${randomUUID()}`;
    withTx(tx => {
      tx.prepare(`INSERT INTO proposal (id,kind,subject_type,subject_id,subject_version,payload,affects,state,rationale_ru,sources,created_at)
        VALUES (?,'param_change','supplier',?,?,?,?, 'needs_review',?, '[]',?)`)
        .run(id, change.supplier_id, supplier.version, JSON.stringify(change), JSON.stringify([change.supplier_id]), "Изменение параметров требует подтверждения", new Date().toISOString());
      bumpStateVersion(tx);
    });
    return ok({ proposal_id: id, state: "needs_review" }, 202);
  });
}
