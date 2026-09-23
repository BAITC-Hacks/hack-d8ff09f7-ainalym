import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { db, bumpStateVersion } from "../db/client";
import { startRun, recordAction, finishRun } from "../server/ledger";
import type { EngineParams } from "./engine";

const startRunIn = startRun as (input: Parameters<typeof startRun>[0], database: DatabaseSync) => ReturnType<typeof startRun>;
const recordActionIn = recordAction as (runId: string, action: Parameters<typeof recordAction>[1], database: DatabaseSync) => ReturnType<typeof recordAction>;
const finishRunIn = finishRun as (runId: string, state: "done" | "failed", database: DatabaseSync) => ReturnType<typeof finishRun>;

export const DEFAULT_PARAMS: EngineParams = {
  lead_time_days: 40,
  review_days: 30,
  service_level: 0.9,
  growth_cap: 0.5,
  outlier: { k_month: 3, k_doc: 5, min_units: 20 },
};

export function paramsForSupplier(supplierId: string, database: DatabaseSync = db(), overrides: Partial<EngineParams> = {}): EngineParams {
  const row = database.prepare("SELECT lead_time_days,review_days,terms FROM supplier WHERE id=?")
    .get(supplierId) as { lead_time_days: number; review_days: number; terms: string } | undefined;
  if (!row) throw new Error(`supplier ${supplierId} is missing`);
  const terms = JSON.parse(row.terms || "{}") as { replenishment?: Partial<EngineParams> };
  const stored = terms.replenishment ?? {};
  const merged = {
    ...DEFAULT_PARAMS,
    lead_time_days: row.lead_time_days,
    review_days: row.review_days,
    ...stored,
    ...overrides,
    outlier: { ...DEFAULT_PARAMS.outlier, ...stored.outlier, ...overrides.outlier },
  };
  if (!globalThis.Number.isInteger(merged.lead_time_days) || merged.lead_time_days < 1 ||
      !globalThis.Number.isInteger(merged.review_days) || merged.review_days < 0 ||
      merged.service_level <= 0 || merged.service_level >= 1 ||
      merged.growth_cap < 0 || merged.growth_cap > 1 ||
      merged.outlier.k_month < 1 || merged.outlier.k_doc < 1 || merged.outlier.min_units < 0) {
    throw new RangeError("invalid replenishment parameters");
  }
  return merged;
}

/** A policy edit enters the same owner queue as supplier orders. */
export async function proposeParamChange(supplierId: string, changes: Partial<EngineParams>, ctx: { database?: DatabaseSync; org_id?: string } = {}) {
  const database = ctx.database ?? db();
  const current = database.prepare("SELECT version FROM supplier WHERE id=?").get(supplierId) as { version: number } | undefined;
  if (!current) throw new Error(`supplier ${supplierId} is missing`);
  const proposed = paramsForSupplier(supplierId, database, changes);
  const existing = database.prepare("SELECT id FROM proposal WHERE kind='param_change' AND subject_id=? AND state='needs_review' AND payload=?")
    .get(supplierId, JSON.stringify({ supplier_id: supplierId, changes })) as { id: string } | undefined;
  if (existing) return { id: existing.id, replayed: true };
  const id = `PR-${randomUUID()}`;
  const rationale = `Изменение параметров ${supplierId}: ${JSON.stringify(changes)}. После подтверждения пересчитаются SKU этого поставщика.`;
  database.prepare(`INSERT INTO proposal (id,kind,subject_type,subject_id,subject_version,payload,affects,state,rationale_ru,sources,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(id, "param_change", "supplier", supplierId, current.version,
    JSON.stringify({ supplier_id: supplierId, changes }), JSON.stringify([supplierId]), "needs_review", rationale,
    JSON.stringify([`supplier:${supplierId}`, `supplier_version:${current.version}`]), new Date().toISOString());
  bumpStateVersion(database);
  const runId = await startRunIn({ org_id: ctx.org_id ?? "ORG-1", trigger_type: "goal", trigger_ref: id }, database);
  await recordActionIn(runId, { kind: "escalation", subject_ref: id, summary_ru: `Нужно утвердить параметры ${supplierId}`,
    rationale_ru: rationale, sources: [`supplier:${supplierId}`], autonomy: "escalated", result: "needs_owner",
    idempotency_key: `param_change:${id}` }, database);
  await finishRunIn(runId, "done", database);
  return { id, proposed, replayed: false };
}
