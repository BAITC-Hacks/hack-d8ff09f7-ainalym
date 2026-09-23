import { randomUUID } from "node:crypto";
import { bumpStateVersion, db, withTx } from "@/db/client";
import { orgId } from "@/server/context";
import { ParamsUpdateRequestSchema, SettingsUpdateRequestSchema } from "@/server/contracts";
import { body, handle, HttpError, ok } from "@/server/http";

export const runtime = "nodejs";

type OrgPayload = { opening_cash?: { amount: string; currency: string }[]; opening_cash_as_of?: string; currency?: string; etl_fetched_at?: string } & Record<string, unknown>;
type Terms = { prepay_pct?: number; prepayment_pct?: number; replenishment?: { service_level?: number; growth_cap?: number } } & Record<string, unknown>;

function readOrg(id: string): OrgPayload {
  const row = db().prepare("SELECT payload FROM organization WHERE id=?").get(id) as { payload: string } | undefined;
  try { return row ? JSON.parse(row.payload || "{}") as OrgPayload : {}; } catch { return {}; }
}

/** Settings read: supplier parameters, owner-entered money context and how much of the catalogue still has no unit cost. */
export function paramsView() {
  const d = db();
  const id = orgId();
  const payload = readOrg(id);
  const opening = Array.isArray(payload.opening_cash) && payload.opening_cash.length ? payload.opening_cash[0] : null;
  const suppliers = (d.prepare("SELECT id,lead_time_days,review_days,terms,currency,version FROM supplier ORDER BY id").all() as Record<string, unknown>[]).map(row => {
    let terms: Terms = {};
    try { terms = JSON.parse(String(row.terms || "{}")) as Terms; } catch { terms = {}; }
    return { ...row, terms, prepay_pct: Number(terms.prepay_pct ?? terms.prepayment_pct ?? 30), service_level: Number(terms.replenishment?.service_level ?? 0.9), growth_cap: Number(terms.replenishment?.growth_cap ?? 0.5) };
  });
  const cost = d.prepare("SELECT count(*) AS total, sum(CASE WHEN unit_cost IS NULL THEN 1 ELSE 0 END) AS missing FROM sku").get() as { total: number; missing: number | null };
  return {
    suppliers,
    defaults: { service_level: 0.9, growth_cap: 0.5, outlier: { k_month: 3, k_doc: 5, min_units: 20 } },
    org: { id, opening_cash: opening ? { amount: opening.amount, currency: opening.currency, as_of: payload.opening_cash_as_of ?? null } : null, currency: payload.currency ?? opening?.currency ?? "KZT", data_as_of: payload.etl_fetched_at ?? null },
    cost: { skus_total: Number(cost.total ?? 0), skus_without_cost: Number(cost.missing ?? 0) },
  };
}

export async function GET(): Promise<Response> {
  return handle(() => ok(paramsView()));
}

/** Supplier calculation parameters still enter the owner queue as a proposal (unchanged behaviour). */
export async function PUT(request: Request): Promise<Response> {
  return handle(async () => {
    const change = await body(request, ParamsUpdateRequestSchema);
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

/** Owner context (opening cash, currency, payment terms) is applied directly: it is the owner's own fact, not a purchasing decision. */
export async function PATCH(request: Request): Promise<Response> {
  return handle(async () => {
    const change = await body(request, SettingsUpdateRequestSchema);
    if (change.opening_cash === undefined && change.currency === undefined && !change.suppliers?.length) throw new HttpError(400, "empty_change", "No setting changed");
    const id = orgId();
    withTx(tx => {
      const payload = readOrg(id);
      if (change.opening_cash !== undefined) {
        if (change.opening_cash === null) { delete payload.opening_cash; delete payload.opening_cash_as_of; }
        else { payload.opening_cash = [{ amount: change.opening_cash.amount, currency: change.opening_cash.currency }]; payload.opening_cash_as_of = change.opening_cash.as_of; }
      }
      if (change.currency !== undefined) payload.currency = change.currency;
      const exists = tx.prepare("SELECT 1 FROM organization WHERE id=?").get(id);
      if (exists) tx.prepare("UPDATE organization SET payload=? WHERE id=?").run(JSON.stringify(payload), id);
      else tx.prepare("INSERT INTO organization (id,name,payload) VALUES (?,?,?)").run(id, "partner", JSON.stringify(payload));
      for (const s of change.suppliers ?? []) {
        const row = tx.prepare("SELECT terms FROM supplier WHERE id=?").get(s.id) as { terms: string } | undefined;
        if (!row) throw new HttpError(404, "not_found", "Supplier not found");
        let terms: Terms = {};
        try { terms = JSON.parse(row.terms || "{}") as Terms; } catch { terms = {}; }
        terms.prepay_pct = s.prepay_pct;
        delete terms.prepayment_pct; delete terms.prepayment_percent;
        tx.prepare("UPDATE supplier SET terms=?, version=version+1 WHERE id=?").run(JSON.stringify(terms), s.id);
      }
      bumpStateVersion(tx);
    });
    return ok({ saved: true, ...paramsView() });
  });
}
