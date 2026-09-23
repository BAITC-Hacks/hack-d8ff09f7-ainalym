import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { db, bumpStateVersion, stateVersion, withTx } from "../db/client";
import { startRun, recordAction, finishRun } from "../server/ledger";
import { computeNeed, type EngineContext, type EngineParams, type NeedResult } from "./engine";
import { paramsForSupplier } from "./params";
import { Money } from "./money";
import { transitionTask } from "./tasks";
import { createTask } from "./tasks";
import { syncOrderObligations } from "./obligations";

export interface CalcScope { supplier?: string; category?: string; codes?: string[]; full_catalog?: boolean }
export interface CalcContext extends EngineContext { org_id?: string; agent_run_id?: string; world_event_id?: string }
export interface ApplyResult { proposals: Record<string, unknown>[]; tasks: Record<string, unknown>[]; affected: string[] }
type Sku = { code_1c: string; supplier_id: string; name: string; unit: string | null; unit_cost: string | null; moq: number };
type Rec = { id: string; code_1c: string; supplier_id: string; qty_recommended: number; qty_adjusted: number | null; rationale_ru: string; proposal_id: string | null; unit_cost: string | null; name: string; unit: string | null; components: string };
type Run = { id: string; agent_run_id: string | null; scope: string; org_id: string | null };

function inTx<T>(database: DatabaseSync, fn: () => T): T {
  database.exec("BEGIN");
  try { const result = fn(); database.exec("COMMIT"); return result; }
  catch (error) { database.exec("ROLLBACK"); throw error; }
}

function reasonRu(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/stock source missing/i.test(message)) return "нет подтверждённого остатка";
  if (/uncensored sales source missing/i.test(message)) return "нет месяцев продаж без дефицита";
  if (/sales source missing/i.test(message)) return "нет истории продаж";
  if (/invalid engine parameters/i.test(message)) return "неверные параметры расчёта";
  return "ошибка расчёта; проверьте данные артикула";
}

/** Computes and persists a full run before preparing human approval proposals. */
export async function runCalculation(scope: CalcScope = {}, overrides: Partial<EngineParams> = {}, ctx: CalcContext = {}) {
  const database = ctx.database ?? db();
  const orgId = ctx.org_id ?? "ORG-1";
  const query = `SELECT code_1c,supplier_id,name,unit,unit_cost,moq FROM sku WHERE 1=1${scope.supplier ? " AND supplier_id=?" : ""}${scope.category ? " AND category=?" : ""} ORDER BY supplier_id,code_1c`;
  const skus = (database.prepare(query).all(...[scope.supplier, scope.category].filter((value) => value !== undefined)) as Sku[])
    .filter((sku) => !scope.codes || scope.codes.includes(sku.code_1c));
  const computed: { sku: Sku; result: NeedResult; params: EngineParams }[] = [];
  const unresolved: { code_1c: string; supplier_id: string; reason: string }[] = [];
  for (const sku of skus) {
    try {
      const params = paramsForSupplier(sku.supplier_id, database, overrides);
      const result = await computeNeed(sku.code_1c, params, { database, as_of: ctx.as_of });
      if (result.components.stock_stale) unresolved.push({ code_1c: sku.code_1c, supplier_id: sku.supplier_id,
        reason: `не рассчитано: нет актуального остатка; последний подтверждённый месяц ${result.components.stock_month}` });
      else computed.push({ sku, params, result });
    }
    catch (error) {
      unresolved.push({ code_1c: sku.code_1c, supplier_id: sku.supplier_id, reason: `не рассчитано: ${reasonRu(error)}` });
    }
  }
  const id = `RUN-${randomUUID()}`;
  const agentRunId = ctx.agent_run_id ?? await startRun({ org_id: orgId, trigger_type: "calc_request", trigger_ref: id }, database);
  const startedAt = new Date().toISOString();
  const finishedAt = ctx.as_of && ctx.as_of > startedAt ? ctx.as_of : startedAt;
  inTx(database, () => {
    database.prepare("INSERT INTO calc_run (id,org_id,scope,params,started_at,finished_at,skus,recommended,agent_run_id) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(id, orgId, JSON.stringify(scope), JSON.stringify(overrides), startedAt, finishedAt, skus.length, computed.filter(({ result }) => result.need > 0).length, agentRunId);
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
    await recordAction(agentRunId, { kind: "recompute", subject_ref: sku.code_1c, code_1c: sku.code_1c, world_event_id: ctx.world_event_id,
      summary_ru: `Пересчитана потребность ${sku.code_1c}: ${result.need} ${sku.unit?.trim() || "шт"}`, rationale_ru: result.rationale_ru,
      sources: [`sku:${sku.code_1c}`, "sales_month", "sales_line", "stock_month", "in_transit"], autonomy: "auto",
      idempotency_key: ctx.world_event_id ? `worker:${ctx.world_event_id}:recompute:${sku.code_1c}` : `recompute:${id}:${sku.code_1c}` }, database);
    if ((result.components.outliers_excluded as unknown[]).length) await recordAction(agentRunId, {
      kind: "outlier_flagged", subject_ref: sku.code_1c, code_1c: sku.code_1c,
      summary_ru: `Исключены разовые документы по ${sku.code_1c}`, rationale_ru: result.rationale_ru,
      sources: result.components.outliers_excluded as unknown[], autonomy: "auto", idempotency_key: `outlier:${id}:${sku.code_1c}` }, database);
  }
  const applied = await applyRecommendations(id, { database, org_id: orgId });
  for (const supplierId of [...new Set(unresolved.map((row) => row.supplier_id))]) {
    const gaps = unresolved.filter((row) => row.supplier_id === supplierId);
    const task = await createTask({ title: `Проверить отсутствующие источники ${supplierId}: ${gaps.length} SKU`, state: "needs_review",
      sources: gaps.map((row) => `${row.code_1c}: ${row.reason}`) }, { database, org_id: orgId, run_id: agentRunId });
    applied.tasks.push(task);
    await recordAction(agentRunId, { kind: "escalation", subject_ref: task.id,
      summary_ru: `Требуются данные для ${gaps.length} SKU ${supplierId}`,
      rationale_ru: `${gaps.slice(0, 5).map((row) => `${row.code_1c}: ${row.reason}`).join("; ")}${gaps.length > 5 ? `; и ещё ${gaps.length - 5} SKU` : ""}`,
      sources: gaps.map((row) => row.code_1c), autonomy: "escalated", result: "needs_owner", idempotency_key: `source-gap:${id}:${supplierId}` }, database);
  }
  if (!ctx.agent_run_id) await finishRun(agentRunId, "done", database);
  return { run_id: id, skus: skus.length, computed: computed.length, not_computed: unresolved.length,
    recommended: computed.filter(({ result }) => result.need > 0).length, unresolved, ...applied };
}

/** One supplier order proposal per supplier; replay and newer runs are safe. */
export async function applyRecommendations(run_id: string, ctx: CalcContext = {}): Promise<ApplyResult> {
  const database = ctx.database ?? db();
  const run = database.prepare("SELECT id,agent_run_id,scope,org_id FROM calc_run WHERE id=?").get(run_id) as Run | undefined;
  if (!run) throw new Error(`calculation run ${run_id} is missing`);
  const scope = JSON.parse(run.scope) as CalcScope;
  const scopedCodes = new Set(scope.codes ?? []);
  const recommendations = database.prepare(`SELECT r.id,r.code_1c,r.supplier_id,r.qty_recommended,r.qty_adjusted,r.rationale_ru,r.proposal_id,r.components,s.name,s.unit,s.unit_cost
    FROM recommendation r JOIN sku s ON s.code_1c=r.code_1c WHERE r.run_id=? ORDER BY r.supplier_id,r.code_1c`).all(run_id) as Rec[];
  const groups = new Map<string, Rec[]>();
  const staleStock = recommendations.filter((rec) => (JSON.parse(rec.components) as { stock_stale?: boolean }).stock_stale);
  const staleStockIds = new Set(staleStock.map((rec) => rec.id));
  for (const rec of recommendations) {
    if (staleStockIds.has(rec.id)) continue;
    if ((rec.qty_adjusted ?? rec.qty_recommended) <= 0) continue;
    groups.set(rec.supplier_id, [...(groups.get(rec.supplier_id) ?? []), rec]);
  }
  const scopedSkus = database.prepare(`SELECT code_1c,supplier_id FROM sku WHERE 1=1${scope.supplier ? " AND supplier_id=?" : ""}${scope.category ? " AND category=?" : ""}`)
    .all(...[scope.supplier, scope.category].filter(value => value !== undefined)) as { code_1c: string; supplier_id: string }[];
  for (const sku of scopedSkus) if ((scope.full_catalog || !scopedCodes.size || scopedCodes.has(sku.code_1c)) && !groups.has(sku.supplier_id)) groups.set(sku.supplier_id, []);
  const proposals: Record<string, unknown>[] = [];
  const tasks: Record<string, unknown>[] = [];
  for (const [supplierId, rows] of groups) {
    const existingId = rows[0]?.proposal_id;
    if (existingId) {
      const existing = database.prepare("SELECT * FROM proposal WHERE id=?").get(existingId) as Record<string, unknown> | undefined;
      if (existing) proposals.push(existing);
      continue;
    }
    const oldProposals = database.prepare("SELECT id,payload,sources,version FROM proposal WHERE kind='supplier_order' AND subject_id=? AND state='needs_review' AND (org_id=? OR org_id IS NULL) ORDER BY created_at DESC,rowid DESC")
      .all(supplierId, run.org_id ?? ctx.org_id ?? "ORG-1") as { id: string; payload: string; sources: string; version: number }[];
    const old = oldProposals[0];
    const id = `PR-${randomUUID()}`;
    const taskId = `TK-${randomUUID()}`;
    const currentLines = rows.map((rec) => ({ recommendation_id: rec.id, code_1c: rec.code_1c, name: rec.name, unit: rec.unit?.trim() || "шт",
      qty: rec.qty_adjusted ?? rec.qty_recommended, unit_cost: rec.unit_cost, rationale_ru: rec.rationale_ru,
      components: JSON.parse(rec.components) as Record<string, unknown> }));
    const carried = old && scopedCodes.size ? ((JSON.parse(old.payload) as { lines: typeof currentLines }).lines ?? [])
      .filter((line) => !scopedCodes.has(line.code_1c)) : [];
    const lines = [...carried, ...currentLines];
    if (!lines.length) {
      if (oldProposals.length) {
        inTx(database, () => {
          database.prepare("UPDATE proposal SET state='stale',version=version+1 WHERE kind='supplier_order' AND subject_id=? AND state='needs_review' AND (org_id=? OR org_id IS NULL)")
            .run(supplierId, run.org_id ?? ctx.org_id ?? "ORG-1");
          bumpStateVersion(database);
        });
        if (run.agent_run_id) for (const prior of oldProposals) await recordAction(run.agent_run_id, { kind: "status_change", subject_ref: prior.id,
          summary_ru: `Предложение ${prior.id} устарело: потребность исчезла`, sources: [`proposal:${prior.id}`, `run:${run_id}`],
          autonomy: "auto", idempotency_key: `proposal:stale:${prior.id}:${run_id}` }, database);
      }
      continue;
    }
    const priced = lines.filter((line) => line.unit_cost !== null);
    const total = priced.reduce((sum, line) => sum.add(Money.of(line.unit_cost!).mul(line.qty)), Money.of("0"));
    const moneyAtStake = priced.length ? total.toJSON() : null;
    const rationale = `Заказ ${supplierId}: ${lines.length} позиций. ${priced.length === lines.length ? `Стоимость ${total.amount} KZT.` : `Стоимость известна для ${priced.length} из ${lines.length} позиций; неизвестные цены требуют проверки.`} Подтвердите точный состав и количество перед передачей.`;
    const sources = [...new Set([...rows.map((row) => `recommendation:${row.id}`), ...carried.map((line) => `recommendation:${line.recommendation_id}`)])];
    const proposal = { id, org_id: run.org_id ?? ctx.org_id ?? "ORG-1", kind: "supplier_order", subject_type: "supplier", subject_id: supplierId, subject_version: old ? old.version + 1 : 1,
      payload: JSON.stringify({ run_id, supplier_id: supplierId, lines, cost_known_lines: priced.length }),
      affects: JSON.stringify(lines.map(line => line.code_1c)), supersedes_id: old?.id ?? null, state: "needs_review",
      rationale_ru: rationale, sources: JSON.stringify(sources), money_at_stake: moneyAtStake ? JSON.stringify(moneyAtStake) : null,
      version: old ? old.version + 1 : 1, created_at: new Date().toISOString() };
    inTx(database, () => {
      database.prepare("UPDATE proposal SET state='stale',version=version+1 WHERE kind='supplier_order' AND subject_id=? AND state='needs_review' AND (org_id=? OR org_id IS NULL)")
        .run(supplierId, proposal.org_id);
      database.prepare(`INSERT INTO proposal (id,org_id,kind,subject_type,subject_id,subject_version,payload,affects,supersedes_id,state,rationale_ru,sources,money_at_stake,version,created_at)
        VALUES (@id,@org_id,@kind,@subject_type,@subject_id,@subject_version,@payload,@affects,@supersedes_id,@state,@rationale_ru,@sources,@money_at_stake,@version,@created_at)`).run(proposal);
      for (const rec of rows) database.prepare("UPDATE recommendation SET proposal_id=? WHERE id=?").run(id, rec.id);
      for (const line of carried) database.prepare("UPDATE recommendation SET proposal_id=? WHERE id=?").run(id, line.recommendation_id);
      database.prepare("INSERT INTO task (id,title,state,owner_role,proposal_id,updated_at) VALUES (?,?,?,?,?,?)")
        .run(taskId, `Проверить заказ ${supplierId}`, "needs_review", "purchasing_manager", id, proposal.created_at);
      bumpStateVersion(database);
    });
    proposals.push(proposal);
    tasks.push({ id: taskId, proposal_id: id, state: "needs_review" });
    if (run.agent_run_id) {
      for (const prior of oldProposals) await recordAction(run.agent_run_id, { kind: "status_change", subject_ref: prior.id,
        summary_ru: `Предложение ${prior.id} заменено новой версией ${id}`, sources: [`proposal:${prior.id}`, `proposal:${id}`],
        autonomy: "auto", idempotency_key: `proposal:stale:${prior.id}:${run_id}` }, database);
      await recordAction(run.agent_run_id, { kind: "recommendation_prepared", subject_ref: supplierId,
        summary_ru: `Подготовлены рекомендации ${supplierId}: ${lines.length} позиций`, rationale_ru: rationale,
        sources, autonomy: "auto", idempotency_key: `recommendation:${run_id}:${supplierId}` }, database);
      await recordAction(run.agent_run_id, { kind: "status_change", subject_ref: taskId,
        summary_ru: `Создана задача проверить заказ ${supplierId}`, rationale_ru: `Задача связана с предложением ${id}.`,
        sources: [`proposal:${id}`, ...sources], autonomy: "auto", idempotency_key: `task:create:${taskId}` }, database);
      await recordAction(run.agent_run_id, { kind: "escalation", subject_ref: id,
        summary_ru: `Нужно решение по заказу ${supplierId}`, rationale_ru: rationale,
        sources, autonomy: "escalated", result: "needs_owner", idempotency_key: `escalation:${id}` }, database);
    }
  }
  for (const rec of staleStock) {
    const title = `Уточнить текущий остаток ${rec.code_1c} (${run_id})`;
    const existing = database.prepare("SELECT id,state FROM task WHERE title=?").get(title) as { id: string; state: string } | undefined;
    if (existing) { tasks.push(existing); continue; }
    tasks.push(await createTask({ title, state: "needs_review", sources: [`recommendation:${rec.id}`, `sku:${rec.code_1c}`, "stock_month"] },
      { database, org_id: ctx.org_id, run_id: run.agent_run_id ?? undefined }));
  }
  return { proposals, tasks, affected: [...new Set([...recommendations.map((row) => row.code_1c), ...scopedCodes])] };
}

export class ProposalConflictError extends Error { readonly status = 409; }
export class ProposalNotFoundError extends Error { readonly status = 404; }
type Proposal = { id: string; kind: string; state: string; version: number; payload: string; subject_id: string | null; subject_version: number | null; rationale_ru: string | null; sources: string };
type OrderLine = { recommendation_id: string; code_1c: string; qty: number; unit?: string; unit_cost: string | null; rationale_ru: string };

/** A human adjustment changes the proposal version while retaining the engine's original quantity. */
export async function adjustRecommendation(id: string, qty: number, reason: string, version: number, ctx: CalcContext = {}) {
  if (!globalThis.Number.isSafeInteger(qty) || qty < 0 || !reason.trim() || reason.trim().length > 200 || !globalThis.Number.isSafeInteger(version))
    throw new RangeError("invalid adjustment");
  const database = ctx.database ?? db();
  const write = () => {
    const rec = database.prepare("SELECT id,run_id,code_1c,qty_recommended,qty_adjusted,proposal_id,version,state FROM recommendation WHERE id=?")
      .get(id) as { id: string; run_id: string; code_1c: string; qty_recommended: number; qty_adjusted: number | null; proposal_id: string | null; version: number; state: string } | undefined;
    if (!rec) throw new ProposalNotFoundError(`recommendation ${id} is missing`);
    if (rec.version !== version || !["proposed", "adjusted"].includes(rec.state)) throw new ProposalConflictError(`recommendation ${id} is stale`);
    if (!rec.proposal_id) throw new ProposalConflictError("recommendation has no review proposal");
    const proposal = database.prepare("SELECT id,payload,version,state,rationale_ru FROM proposal WHERE id=?")
      .get(rec.proposal_id) as { id: string; payload: string; version: number; state: string; rationale_ru: string | null } | undefined;
    if (!proposal || proposal.state !== "needs_review") throw new ProposalConflictError("proposal is no longer adjustable");
    const payload = JSON.parse(proposal.payload) as { lines: OrderLine[]; [key: string]: unknown };
    const line = payload.lines.find((item) => item.recommendation_id === id);
    if (!line) throw new ProposalConflictError("recommendation is absent from proposal");
    line.qty = qty;
    const priced = payload.lines.filter((item) => item.unit_cost !== null);
    const moneyAtStake = priced.length ? priced.reduce((sum, item) => sum.add(Money.of(item.unit_cost!).mul(item.qty)), Money.of("0")).toJSON() : null;
    payload.total_qty = payload.lines.reduce((sum, item) => sum + item.qty, 0);
    payload.total_cost = moneyAtStake;
    payload.cost_known_lines = priced.length;
    const unit = line.unit ?? (database.prepare("SELECT unit FROM sku WHERE code_1c=?").get(rec.code_1c) as { unit: string | null } | undefined)?.unit ?? "шт";
    const rationale = `${proposal.rationale_ru ?? ""} Корректировка ${rec.code_1c}: ${rec.qty_adjusted ?? rec.qty_recommended} → ${qty} ${unit}; причина: ${reason.trim()}.`.trim();
    const updated = database.prepare("UPDATE recommendation SET qty_adjusted=?,adjust_reason=?,state='adjusted',version=version+1 WHERE id=? AND version=?")
      .run(qty, reason.trim(), id, version);
    if (updated.changes !== 1) throw new ProposalConflictError(`recommendation ${id} is stale`);
    const changed = database.prepare("UPDATE proposal SET payload=?,money_at_stake=?,rationale_ru=?,version=version+1 WHERE id=? AND version=? AND state='needs_review'")
      .run(JSON.stringify(payload), moneyAtStake ? JSON.stringify(moneyAtStake) : null, rationale, proposal.id, proposal.version);
    if (changed.changes !== 1) throw new ProposalConflictError("proposal changed during adjustment");
    const run = database.prepare("SELECT agent_run_id FROM calc_run WHERE id=?").get(rec.run_id) as { agent_run_id: string | null } | undefined;
    const orgId = ctx.org_id ?? (database.prepare("SELECT id FROM organization LIMIT 1").get() as { id: string } | undefined)?.id ?? "ORG-1";
    const runId = run?.agent_run_id ?? startRun({ org_id: orgId, trigger_type: "goal", trigger_ref: id }, database, false);
    recordAction(runId, { kind: "recommendation_adjusted", subject_ref: id, code_1c: rec.code_1c,
      summary_ru: `Количество ${rec.code_1c} изменено на ${qty} ${unit}`, rationale_ru: reason.trim(),
      sources: [`recommendation:${id}`, `proposal:${proposal.id}`], autonomy: "escalated", result: "done",
      idempotency_key: `recommendation:adjust:${id}:${version + 1}` }, database, false);
    if (!run?.agent_run_id) finishRun(runId, "done", database, false);
    bumpStateVersion(database);
    return { id, code_1c: rec.code_1c, qty_recommended: rec.qty_recommended, qty_adjusted: qty,
      adjust_reason: reason.trim(), version: version + 1, proposal_id: proposal.id, proposal_version: proposal.version + 1,
      affected: { recommendations: [id], proposals: [proposal.id] }, state_version: stateVersion(database) };
  };
  return ctx.database ? inTx(database, write) : withTx(write);
}

/** Approval binds the exact proposal version and creates a local PO, never a supplier send. */
export async function decideProposal(id: string, proposalVersion: number, decision: "approve" | "reject",
  adjustments: { code_1c: string; qty: number }[] = [], ctx: CalcContext & { by?: string } = {}) {
  const database = ctx.database ?? db();
  const proposal = database.prepare("SELECT id,kind,state,version,payload,subject_id,subject_version,rationale_ru,sources FROM proposal WHERE id=?").get(id) as Proposal | undefined;
  if (!proposal) throw new ProposalNotFoundError(`proposal ${id} is missing`);
  if (proposal.version !== proposalVersion || proposal.state !== "needs_review") throw new ProposalConflictError(`proposal ${id} is stale`);
  const payload = JSON.parse(proposal.payload) as { run_id?: string; supplier_id?: string; lines?: OrderLine[]; task_id?: string; task_version?: number;
    changes?: Partial<EngineParams>; code_1c?: string; doc_no?: string; ym?: string; state?: "excluded" | "kept";
    parts?: { now: { eta: string; lines: OrderLine[]; total_qty: number; total_cost: string | null };
      later: { eta: string; lines: OrderLine[]; total_qty: number; total_cost: string | null } };
    decision?: { affected_lines?: string[] } };
  const adjustmentMap = new Map(adjustments.map((row) => [row.code_1c, row.qty]));
  if (adjustmentMap.size !== adjustments.length || adjustments.some((row) => !globalThis.Number.isSafeInteger(row.qty) || row.qty < 0))
    throw new RangeError("invalid adjustments");
  if (proposal.kind === "supplier_order" && adjustments.some((row) => !payload.lines?.some((line) => line.code_1c === row.code_1c)))
    throw new RangeError("adjustment references a different order");
  const at = new Date().toISOString();
  const approvalId = `AP-${randomUUID()}`;
  let poId: string | null = null;
  let totalCost: ReturnType<Money["toJSON"]> | null = null;
  let recomputeScope: CalcScope | null = null;
  const affected = payload.decision?.affected_lines ?? (payload.lines ?? []).map((line) => line.code_1c);
  let splitOrderIds: [string, string] | null = null;
  if ((proposal.kind === "supplier_split" || proposal.kind === "supplier_expedite") && adjustments.length)
    throw new RangeError("Измените состав заказа отдельным решением");
  inTx(database, () => {
    const updated = database.prepare("UPDATE proposal SET state=?,version=version+1 WHERE id=? AND version=? AND state='needs_review'")
      .run(decision === "approve" ? "approved" : "rejected", id, proposalVersion);
    if (updated.changes !== 1) throw new ProposalConflictError(`proposal ${id} is stale`);
    database.prepare("INSERT INTO approval (id,proposal_id,proposal_version,decision,adjustments,by,at) VALUES (?,?,?,?,?,?,?)")
      .run(approvalId, id, proposalVersion, decision, JSON.stringify(adjustments), ctx.by ?? "owner", at);
    if (proposal.kind === "supplier_split" && decision === "approve") {
      const original = database.prepare("SELECT id,supplier_id,state,version,total_qty,total_cost FROM purchase_order WHERE id=?")
        .get(proposal.subject_id) as { id: string; supplier_id: string; state: string; version: number; total_qty: number; total_cost: string | null } | undefined;
      const parts = payload.parts;
      if (!original || original.state !== "approved" || original.version !== proposal.subject_version ||
          !parts || !parts.now.lines.length || !parts.later.lines.length ||
          parts.now.total_qty + parts.later.total_qty !== original.total_qty ||
          database.prepare("SELECT 1 FROM obligation WHERE po_id=? AND state='settled'").get(original.id))
        throw new ProposalConflictError("Заказ изменился; проверьте предложение заново");
      const originalLines = database.prepare("SELECT code_1c,qty,unit_cost FROM purchase_order_line WHERE po_id=? ORDER BY id")
        .all(original.id) as { code_1c: string; qty: number; unit_cost: string | null }[];
      const planned = [...parts.now.lines, ...parts.later.lines];
      const totals = (lines: { code_1c: string; qty: number; unit_cost: string | null }[]) => {
        const byLine = new Map<string, number>();
        for (const line of lines) {
          if (!Number.isSafeInteger(line.qty) || line.qty < 1) throw new ProposalConflictError("Количество заказа изменилось; проверьте предложение заново");
          const key = JSON.stringify([line.code_1c, line.unit_cost]);
          byLine.set(key, (byLine.get(key) ?? 0) + line.qty);
        }
        return [...byLine].sort(([a], [b]) => a.localeCompare(b));
      };
      if (JSON.stringify(totals(originalLines)) !== JSON.stringify(totals(planned)) ||
          parts.now.lines.reduce((sum, line) => sum + line.qty, 0) !== parts.now.total_qty ||
          parts.later.lines.reduce((sum, line) => sum + line.qty, 0) !== parts.later.total_qty)
        throw new ProposalConflictError("Количество заказа изменилось; проверьте предложение заново");
      if (original.total_cost !== null &&
          (!parts.now.total_cost || !parts.later.total_cost ||
          Money.of(parts.now.total_cost).add(Money.of(parts.later.total_cost)).amount !== Money.of(original.total_cost).amount))
        throw new ProposalConflictError("Стоимость заказа изменилась; проверьте предложение заново");
      const remainderId = `PO-${randomUUID()}`;
      database.prepare("UPDATE purchase_order SET total_qty=?,total_cost=?,cost_known_lines=?,eta=?,version=version+1 WHERE id=?")
        .run(parts.now.total_qty, parts.now.total_cost, parts.now.lines.filter(line => line.unit_cost !== null).length, parts.now.eta, original.id);
      database.prepare("DELETE FROM purchase_order_line WHERE po_id=?").run(original.id);
      database.prepare("INSERT INTO purchase_order(id,supplier_id,state,total_qty,total_cost,cost_known_lines,eta) VALUES (?,?,'approved',?,?,?,?)")
        .run(remainderId, original.supplier_id, parts.later.total_qty, parts.later.total_cost,
          parts.later.lines.filter(line => line.unit_cost !== null).length, parts.later.eta);
      for (const [orderId, lines] of [[original.id, parts.now.lines], [remainderId, parts.later.lines]] as const)
        for (const line of lines) database.prepare("INSERT INTO purchase_order_line(po_id,code_1c,qty,unit_cost,rationale_ru,recommendation_id) VALUES (?,?,?,?,?,?)")
          .run(orderId, line.code_1c, line.qty, line.unit_cost, line.rationale_ru, line.recommendation_id);
      syncOrderObligations(original.id, database);
      syncOrderObligations(remainderId, database);
      splitOrderIds = [original.id, remainderId];
      totalCost = original.total_cost ? Money.of(original.total_cost).toJSON() : null;
    }
    if (proposal.kind === "supplier_expedite" && decision === "approve") {
      const original = database.prepare("SELECT id,state,version FROM purchase_order WHERE id=?").get(proposal.subject_id) as
        { id: string; state: string; version: number } | undefined;
      if (!original || original.state !== "approved" || original.version !== proposal.subject_version)
        throw new ProposalConflictError("Заказ изменился; проверьте предложение заново");
      for (const code of affected) database.prepare(`UPDATE recommendation SET urgency='critical',version=version+1
        WHERE id IN (SELECT recommendation_id FROM purchase_order_line WHERE po_id=? AND code_1c=? AND recommendation_id IS NOT NULL)`)
        .run(original.id, code);
      database.prepare("INSERT INTO task(id,title,state,owner_role,proposal_id,updated_at) VALUES (?,?, 'needs_review','purchasing_manager',?,?)")
        .run(`TK-${randomUUID()}`, `Согласовать ускорение заказа ${original.id}; ничего не отправлено`, null, at);
    }
    if (proposal.kind === "supplier_order") {
      if (decision === "approve") {
        const lines = (payload.lines ?? []).map((line) => ({ ...line, qty: adjustmentMap.get(line.code_1c) ?? line.qty })).filter((line) => line.qty > 0);
        if (!lines.length) throw new RangeError("an approved order needs at least one line");
        const supplier = database.prepare("SELECT lead_time_days,terms FROM supplier WHERE id=?").get(payload.supplier_id!) as { lead_time_days: number; terms: string } | undefined;
        if (!supplier) throw new Error("supplier is missing");
        poId = `PO-${randomUUID()}`;
        const etaDate = new Date(at);
        etaDate.setUTCDate(etaDate.getUTCDate() + supplier.lead_time_days);
        const eta = etaDate.toISOString();
        const priced = lines.filter((line) => line.unit_cost !== null);
        const cost = priced.reduce((sum, line) => sum.add(Money.of(line.unit_cost!).mul(line.qty)), Money.of("0"));
        totalCost = priced.length === lines.length ? cost.toJSON() : null;
        database.prepare("INSERT INTO purchase_order (id,supplier_id,run_id,state,total_qty,total_cost,cost_known_lines,eta) VALUES (?,?,?,?,?,?,?,?)")
          .run(poId, payload.supplier_id!, payload.run_id ?? null, "draft", lines.reduce((sum, line) => sum + line.qty, 0), totalCost?.amount ?? null, priced.length, eta);
        for (const line of lines) {
          database.prepare("INSERT INTO purchase_order_line (po_id,code_1c,qty,unit_cost,rationale_ru,recommendation_id) VALUES (?,?,?,?,?,?)")
            .run(poId, line.code_1c, line.qty, line.unit_cost, line.rationale_ru, line.recommendation_id);
          database.prepare("UPDATE recommendation SET qty_adjusted=?,state='approved',version=version+1 WHERE id=?")
            .run(adjustmentMap.has(line.code_1c) ? line.qty : null, line.recommendation_id);
        }
      } else {
        for (const line of payload.lines ?? []) database.prepare("UPDATE recommendation SET state='rejected',version=version+1 WHERE id=?")
          .run(line.recommendation_id);
      }
    }
    if (decision === "approve" && proposal.kind === "param_change") {
      const supplierId = payload.supplier_id ?? proposal.subject_id;
      if (!supplierId || !payload.changes) throw new RangeError("invalid parameter proposal");
      const supplier = database.prepare("SELECT version,terms FROM supplier WHERE id=?").get(supplierId) as { version: number; terms: string } | undefined;
      if (!supplier || supplier.version !== proposal.subject_version) throw new ProposalConflictError("supplier parameters changed since proposal");
      const values = paramsForSupplier(supplierId, database, payload.changes);
      const terms = JSON.parse(supplier.terms || "{}") as Record<string, unknown>;
      terms.replenishment = { service_level: values.service_level, growth_cap: values.growth_cap, outlier: values.outlier };
      database.prepare("UPDATE supplier SET lead_time_days=?,review_days=?,terms=?,version=version+1 WHERE id=? AND version=?")
        .run(values.lead_time_days, values.review_days, JSON.stringify(terms), supplierId, supplier.version);
      recomputeScope = { supplier: supplierId };
    }
    if (decision === "approve" && proposal.kind === "outlier_review") {
      if (!payload.code_1c || !payload.doc_no || !payload.ym || !payload.state) throw new RangeError("invalid outlier proposal");
      const existing = database.prepare("SELECT id FROM outlier_doc WHERE code_1c=? AND doc_no=? AND substr(at,1,7)=? LIMIT 1")
        .get(payload.code_1c, payload.doc_no, payload.ym) as { id: number } | undefined;
      if (existing) database.prepare("UPDATE outlier_doc SET state=?,decision='owner' WHERE id=?").run(payload.state, existing.id);
      else {
        const source = database.prepare("SELECT at,SUM(CAST(qty AS REAL)) AS qty FROM sales_line WHERE code_1c=? AND doc_no=? AND substr(at,1,7)=? GROUP BY substr(at,1,7)")
          .get(payload.code_1c, payload.doc_no, payload.ym) as { at: string; qty: number } | undefined;
        if (!source) throw new RangeError("outlier document is missing");
        database.prepare("INSERT INTO outlier_doc (code_1c,doc_no,at,qty,rule,decision,state) VALUES (?,?,?,?,?,?,?)")
          .run(payload.code_1c, payload.doc_no, source.at, String(source.qty), "owner_review", "owner", payload.state);
      }
      recomputeScope = { codes: [payload.code_1c] };
    }
    bumpStateVersion(database);
  });
  const run = payload.run_id ? database.prepare("SELECT agent_run_id FROM calc_run WHERE id=?").get(payload.run_id) as { agent_run_id: string | null } | undefined : undefined;
  const runId = run?.agent_run_id ?? await startRun({ org_id: ctx.org_id ?? "ORG-1", trigger_type: "goal", trigger_ref: id }, database);
  await recordAction(runId, { kind: "decision", subject_ref: id,
    summary_ru: decision === "approve" ? `Одобрено предложение ${id}` : `Отклонено предложение ${id}`,
    rationale_ru: proposal.rationale_ru ?? undefined, sources: JSON.parse(proposal.sources),
    autonomy: "escalated", result: "done", idempotency_key: `decision:${id}:${proposalVersion}`,
    po_id: poId ?? undefined }, database);
  if (poId) await recordAction(runId, { kind: "order_drafted", subject_ref: poId, po_id: poId,
    summary_ru: `Подготовлен черновик заказа ${poId}`, rationale_ru: `Основание — утверждённое предложение ${id}, версия ${proposalVersion}.`,
    sources: [`proposal:${id}`, ...JSON.parse(proposal.sources) as string[]], autonomy: "auto",
    idempotency_key: `order:draft:${poId}` }, database);
  if (!run?.agent_run_id) await finishRun(runId, "done", database);
  const linkedTask = database.prepare("SELECT id,state,version FROM task WHERE proposal_id=?").get(id) as { id: string; state: string; version: number } | undefined;
  if (linkedTask?.state === "needs_review") await transitionTask(linkedTask.id, decision === "approve" ? "ready_to_handover" : "preparing", linkedTask.version, { database, org_id: ctx.org_id });
  if (decision === "approve" && proposal.kind === "clarification" && payload.task_id) await createTask({ title: `Подготовить уточнение по ${payload.task_id}`,
    proposal_id: id, sources: [`task:${payload.task_id}`] }, { database, org_id: ctx.org_id });
  const recalculated = recomputeScope ? await runCalculation(recomputeScope, {}, { database, org_id: ctx.org_id }) : null;
  return { id, decision, proposal_version: proposalVersion + 1, po_id: poId, split_po_ids: splitOrderIds as [string, string] | null, total_cost: totalCost,
    recompute_run_id: recalculated?.run_id ?? null, state_version: stateVersion(database), affected };
}
