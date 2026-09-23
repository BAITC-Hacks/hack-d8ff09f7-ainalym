import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { db, bumpStateVersion } from "../db/client";
import { startRun, recordAction, finishRun } from "../server/ledger";
import { computeNeed, type EngineContext, type EngineParams, type NeedResult } from "./engine";
import { paramsForSupplier } from "./params";
import { Money } from "./money";

export interface CalcScope { supplier?: string; category?: string; codes?: string[] }
export interface CalcContext extends EngineContext { org_id?: string }
export interface ApplyResult { proposals: Record<string, unknown>[]; tasks: Record<string, unknown>[]; affected: string[] }
type Sku = { code_1c: string; supplier_id: string; name: string; unit_cost: string | null; moq: number };
type Rec = { id: string; code_1c: string; supplier_id: string; qty_recommended: number; qty_adjusted: number | null; rationale_ru: string; proposal_id: string | null; unit_cost: string | null; name: string; components: string };
type Run = { id: string; agent_run_id: string | null };

function inTx<T>(database: DatabaseSync, fn: () => T): T {
  database.exec("BEGIN");
  try { const result = fn(); database.exec("COMMIT"); return result; }
  catch (error) { database.exec("ROLLBACK"); throw error; }
}

/** Computes and persists a full run before preparing human approval proposals. */
export async function runCalculation(scope: CalcScope = {}, overrides: Partial<EngineParams> = {}, ctx: CalcContext = {}) {
  const database = ctx.database ?? db();
  const orgId = ctx.org_id ?? "ORG-1";
  const query = `SELECT code_1c,supplier_id,name,unit_cost,moq FROM sku WHERE 1=1${scope.supplier ? " AND supplier_id=?" : ""}${scope.category ? " AND category=?" : ""} ORDER BY supplier_id,code_1c`;
  const skus = (database.prepare(query).all(...[scope.supplier, scope.category].filter((value) => value !== undefined)) as Sku[])
    .filter((sku) => !scope.codes || scope.codes.includes(sku.code_1c));
  const computed: { sku: Sku; result: NeedResult; params: EngineParams }[] = [];
  for (const sku of skus) {
    const params = paramsForSupplier(sku.supplier_id, database, overrides);
    computed.push({ sku, params, result: await computeNeed(sku.code_1c, params, { database, as_of: ctx.as_of }) });
  }
  const id = `RUN-${randomUUID()}`;
  const agentRunId = await startRun({ org_id: orgId, trigger_type: "calc_request", trigger_ref: id });
  const startedAt = new Date().toISOString();
  inTx(database, () => {
    database.prepare("INSERT INTO calc_run (id,scope,params,started_at,finished_at,skus,recommended,agent_run_id) VALUES (?,?,?,?,?,?,?,?)")
      .run(id, JSON.stringify(scope), JSON.stringify(overrides), startedAt, startedAt, skus.length, computed.filter(({ result }) => result.need > 0).length, agentRunId);
    for (const { sku, result } of computed) {
      const forecastId = `FC-${randomUUID()}`;
      const recommendationId = `REC-${randomUUID()}`;
      database.prepare("INSERT INTO forecast (id,run_id,code_1c,horizon_months,base_rate,season,growth,stockout_uplift,safety,method_ru) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .run(forecastId, id, sku.code_1c, result.forecast.horizon_months as number, String(result.forecast.base_rate), JSON.stringify(result.forecast.season), String(result.forecast.growth), String(result.forecast.stockout_uplift), String(result.forecast.safety), result.forecast.method_ru as string);
      database.prepare("INSERT INTO recommendation (id,run_id,code_1c,supplier_id,qty_recommended,on_hand,in_transit,forecast_id,urgency,rationale_ru,components) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .run(recommendationId, id, sku.code_1c, sku.supplier_id, result.need, String(result.components.on_hand), String(result.components.in_transit), forecastId, String(result.components.urgency), result.rationale_ru, JSON.stringify(result.components));
    }
    bumpStateVersion(database);
  });
  for (const { sku, result } of computed) {
    await recordAction(agentRunId, { kind: "recompute", subject_ref: sku.code_1c, code_1c: sku.code_1c,
      summary_ru: `Пересчитана потребность ${sku.code_1c}: ${result.need} шт`, rationale_ru: result.rationale_ru,
      sources: [`sku:${sku.code_1c}`, "sales_month", "sales_line", "stock_month", "in_transit"], autonomy: "auto", idempotency_key: `recompute:${id}:${sku.code_1c}` });
    if ((result.components.outliers_excluded as unknown[]).length) await recordAction(agentRunId, {
      kind: "outlier_flagged", subject_ref: sku.code_1c, code_1c: sku.code_1c,
      summary_ru: `Исключены разовые документы по ${sku.code_1c}`, rationale_ru: result.rationale_ru,
      sources: result.components.outliers_excluded as unknown[], autonomy: "auto", idempotency_key: `outlier:${id}:${sku.code_1c}` });
  }
  const applied = await applyRecommendations(id, { database, org_id: orgId });
  await finishRun(agentRunId, "done");
  return { run_id: id, skus: skus.length, recommended: computed.filter(({ result }) => result.need > 0).length, ...applied };
}

/** One supplier order proposal per supplier; replay and newer runs are safe. */
export async function applyRecommendations(run_id: string, ctx: CalcContext = {}): Promise<ApplyResult> {
  const database = ctx.database ?? db();
  const run = database.prepare("SELECT id,agent_run_id FROM calc_run WHERE id=?").get(run_id) as Run | undefined;
  if (!run) throw new Error(`calculation run ${run_id} is missing`);
  const recommendations = database.prepare(`SELECT r.id,r.code_1c,r.supplier_id,r.qty_recommended,r.qty_adjusted,r.rationale_ru,r.proposal_id,r.components,s.name,s.unit_cost
    FROM recommendation r JOIN sku s ON s.code_1c=r.code_1c WHERE r.run_id=? ORDER BY r.supplier_id,r.code_1c`).all(run_id) as Rec[];
  const groups = new Map<string, Rec[]>();
  for (const rec of recommendations) {
    groups.set(rec.supplier_id, [...(groups.get(rec.supplier_id) ?? []), rec]);
  }
  const proposals: Record<string, unknown>[] = [];
  const tasks: Record<string, unknown>[] = [];
  for (const [supplierId, rows] of groups) {
    const existingId = rows[0].proposal_id;
    if (existingId) {
      const existing = database.prepare("SELECT * FROM proposal WHERE id=?").get(existingId) as Record<string, unknown> | undefined;
      if (existing) proposals.push(existing);
      continue;
    }
    const old = database.prepare("SELECT id,payload,sources,version FROM proposal WHERE kind='supplier_order' AND subject_id=? AND state='needs_review' ORDER BY created_at DESC,rowid DESC LIMIT 1")
      .get(supplierId) as { id: string; payload: string; sources: string; version: number } | undefined;
    const id = `PR-${randomUUID()}`;
    const taskId = `TK-${randomUUID()}`;
    const changedCodes = new Set(rows.map(row => row.code_1c));
    const priorLines = old ? (JSON.parse(old.payload) as { lines?: Array<{ recommendation_id: string; code_1c: string; name: string; qty: number; unit_cost: string | null; rationale_ru: string; components: Record<string, unknown> }> }).lines ?? [] : [];
    const carried = priorLines.filter(line => !changedCodes.has(line.code_1c));
    const changed = rows.filter(rec => (rec.qty_adjusted ?? rec.qty_recommended) > 0).map((rec) => ({ recommendation_id: rec.id, code_1c: rec.code_1c, name: rec.name,
      qty: rec.qty_adjusted ?? rec.qty_recommended, unit_cost: rec.unit_cost, rationale_ru: rec.rationale_ru,
      components: JSON.parse(rec.components) as Record<string, unknown> }));
    const lines = [...carried, ...changed].sort((a, b) => a.code_1c.localeCompare(b.code_1c));
    if (!lines.length) {
      if (old) inTx(database, () => {
        database.prepare("UPDATE proposal SET state='stale',version=version+1 WHERE id=? AND state='needs_review'").run(old.id);
        bumpStateVersion(database);
      });
      continue;
    }
    const priced = lines.filter((line) => line.unit_cost !== null);
    const total = priced.reduce((sum, line) => sum.add(Money.of(line.unit_cost!).mul(line.qty)), Money.of("0"));
    const moneyAtStake = priced.length ? total.toJSON() : null;
    const rationale = `Заказ ${supplierId}: ${lines.length} позиций, ${lines.reduce((sum, line) => sum + line.qty, 0)} шт. ${priced.length === lines.length ? `Стоимость ${total.amount} KZT.` : `Стоимость известна для ${priced.length} из ${lines.length} позиций; неизвестные цены требуют проверки.`} Подтвердите точный состав и количество перед передачей.`;
    const sources = lines.map(line => `recommendation:${line.recommendation_id}`);
    const proposal = { id, kind: "supplier_order", subject_type: "supplier", subject_id: supplierId, subject_version: old ? old.version + 1 : 1,
      payload: JSON.stringify({ run_id, supplier_id: supplierId, lines, cost_known_lines: priced.length }),
      affects: JSON.stringify(lines.map(line => line.code_1c)), supersedes_id: old?.id ?? null, state: "needs_review",
      rationale_ru: rationale, sources: JSON.stringify(sources), money_at_stake: moneyAtStake ? JSON.stringify(moneyAtStake) : null,
      version: old ? old.version + 1 : 1, created_at: new Date().toISOString() };
    inTx(database, () => {
      if (old) database.prepare("UPDATE proposal SET state='stale',version=version+1 WHERE id=? AND state='needs_review'").run(old.id);
      database.prepare(`INSERT INTO proposal (id,kind,subject_type,subject_id,subject_version,payload,affects,supersedes_id,state,rationale_ru,sources,money_at_stake,version,created_at)
        VALUES (@id,@kind,@subject_type,@subject_id,@subject_version,@payload,@affects,@supersedes_id,@state,@rationale_ru,@sources,@money_at_stake,@version,@created_at)`).run(proposal);
      for (const rec of rows) database.prepare("UPDATE recommendation SET proposal_id=? WHERE id=?").run(id, rec.id);
      database.prepare("INSERT INTO task (id,title,state,owner_role,proposal_id,updated_at) VALUES (?,?,?,?,?,?)")
        .run(taskId, `Проверить заказ ${supplierId}`, "needs_review", "purchasing_manager", id, proposal.created_at);
      bumpStateVersion(database);
    });
    proposals.push(proposal);
    tasks.push({ id: taskId, proposal_id: id, state: "needs_review" });
    if (run.agent_run_id) {
      await recordAction(run.agent_run_id, { kind: "recommendation_prepared", subject_ref: supplierId,
        summary_ru: `Подготовлены рекомендации ${supplierId}: ${lines.length} позиций`, rationale_ru: rationale,
        sources, autonomy: "auto", idempotency_key: `recommendation:${run_id}:${supplierId}` });
      await recordAction(run.agent_run_id, { kind: "escalation", subject_ref: id,
        summary_ru: `Нужно решение по заказу ${supplierId}`, rationale_ru: rationale,
        sources, autonomy: "escalated", result: "needs_owner", idempotency_key: `escalation:${id}` });
    }
  }
  return { proposals, tasks, affected: recommendations.map((row) => row.code_1c) };
}
