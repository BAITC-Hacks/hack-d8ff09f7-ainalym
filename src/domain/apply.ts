import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { db, bumpStateVersion } from "../db/client";
import { startRun, recordAction, finishRun } from "../server/ledger";
import { computeNeed, type EngineContext, type EngineParams, type NeedResult } from "./engine";
import { paramsForSupplier } from "./params";
import { Money } from "./money";
import { transitionTask } from "./tasks";

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
    if ((rec.qty_adjusted ?? rec.qty_recommended) <= 0) continue;
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
    const old = database.prepare("SELECT id FROM proposal WHERE kind='supplier_order' AND subject_id=? AND state='needs_review' ORDER BY created_at DESC LIMIT 1")
      .get(supplierId) as { id: string } | undefined;
    const id = `PR-${randomUUID()}`;
    const taskId = `TK-${randomUUID()}`;
    const lines = rows.map((rec) => ({ recommendation_id: rec.id, code_1c: rec.code_1c, name: rec.name,
      qty: rec.qty_adjusted ?? rec.qty_recommended, unit_cost: rec.unit_cost, rationale_ru: rec.rationale_ru,
      components: JSON.parse(rec.components) as Record<string, unknown> }));
    const priced = lines.filter((line) => line.unit_cost !== null);
    const total = priced.reduce((sum, line) => sum.add(Money.of(line.unit_cost!).mul(line.qty)), Money.of("0"));
    const moneyAtStake = priced.length ? total.toJSON() : null;
    const rationale = `Заказ ${supplierId}: ${lines.length} позиций, ${lines.reduce((sum, line) => sum + line.qty, 0)} шт. ${priced.length === lines.length ? `Стоимость ${total.amount} KZT.` : `Стоимость известна для ${priced.length} из ${lines.length} позиций; неизвестные цены требуют проверки.`} Подтвердите точный состав и количество перед передачей.`;
    const sources = rows.map((row) => `recommendation:${row.id}`);
    const proposal = { id, kind: "supplier_order", subject_type: "supplier", subject_id: supplierId, subject_version: 1,
      payload: JSON.stringify({ run_id, supplier_id: supplierId, lines, cost_known_lines: priced.length }),
      affects: JSON.stringify(rows.map((row) => row.code_1c)), supersedes_id: old?.id ?? null, state: "needs_review",
      rationale_ru: rationale, sources: JSON.stringify(sources), money_at_stake: moneyAtStake ? JSON.stringify(moneyAtStake) : null,
      version: 1, created_at: new Date().toISOString() };
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

export class ProposalConflictError extends Error { readonly status = 409; }
export class ProposalNotFoundError extends Error { readonly status = 404; }
type Proposal = { id: string; kind: string; state: string; version: number; payload: string; subject_id: string | null; rationale_ru: string | null; sources: string };
type OrderLine = { recommendation_id: string; code_1c: string; qty: number; unit_cost: string | null; rationale_ru: string };

/** Approval binds the exact proposal version and creates a local PO, never a supplier send. */
export async function decideProposal(id: string, proposalVersion: number, decision: "approve" | "reject",
  adjustments: { code_1c: string; qty: number }[] = [], ctx: CalcContext & { by?: string } = {}) {
  const database = ctx.database ?? db();
  const proposal = database.prepare("SELECT id,kind,state,version,payload,subject_id,rationale_ru,sources FROM proposal WHERE id=?").get(id) as Proposal | undefined;
  if (!proposal) throw new ProposalNotFoundError(`proposal ${id} is missing`);
  if (proposal.version !== proposalVersion || proposal.state !== "needs_review") throw new ProposalConflictError(`proposal ${id} is stale`);
  const payload = JSON.parse(proposal.payload) as { run_id?: string; supplier_id?: string; lines?: OrderLine[]; task_id?: string; task_version?: number };
  const adjustmentMap = new Map(adjustments.map((row) => [row.code_1c, row.qty]));
  if (adjustmentMap.size !== adjustments.length || adjustments.some((row) => !globalThis.Number.isSafeInteger(row.qty) || row.qty < 0))
    throw new RangeError("invalid adjustments");
  if (proposal.kind === "supplier_order" && adjustments.some((row) => !payload.lines?.some((line) => line.code_1c === row.code_1c)))
    throw new RangeError("adjustment references a different order");
  const at = new Date().toISOString();
  const approvalId = `AP-${randomUUID()}`;
  let poId: string | null = null;
  let totalCost: ReturnType<Money["toJSON"]> | null = null;
  const affected = (payload.lines ?? []).map((line) => line.code_1c);
  const stateVersion = inTx(database, () => {
    const updated = database.prepare("UPDATE proposal SET state=?,version=version+1 WHERE id=? AND version=? AND state='needs_review'")
      .run(decision === "approve" ? "approved" : "rejected", id, proposalVersion);
    if (updated.changes !== 1) throw new ProposalConflictError(`proposal ${id} is stale`);
    database.prepare("INSERT INTO approval (id,proposal_id,proposal_version,decision,adjustments,by,at) VALUES (?,?,?,?,?,?,?)")
      .run(approvalId, id, proposalVersion, decision, JSON.stringify(adjustments), ctx.by ?? "owner", at);
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
        totalCost = priced.length ? cost.toJSON() : null;
        database.prepare("INSERT INTO purchase_order (id,supplier_id,run_id,state,total_qty,total_cost,cost_known_lines,eta) VALUES (?,?,?,?,?,?,?,?)")
          .run(poId, payload.supplier_id!, payload.run_id ?? null, "approved", lines.reduce((sum, line) => sum + line.qty, 0), totalCost?.amount ?? null, priced.length, eta);
        for (const line of lines) {
          database.prepare("INSERT INTO purchase_order_line (po_id,code_1c,qty,unit_cost,rationale_ru) VALUES (?,?,?,?,?)")
            .run(poId, line.code_1c, line.qty, line.unit_cost, line.rationale_ru);
          database.prepare("UPDATE recommendation SET qty_adjusted=?,state='approved',version=version+1 WHERE id=?")
            .run(adjustmentMap.has(line.code_1c) ? line.qty : null, line.recommendation_id);
        }
        if (priced.length) {
          const terms = JSON.parse(supplier.terms || "{}") as { prepayment_share?: string };
          const prepayment = cost.mul(terms.prepayment_share ?? "0.30");
          const balance = cost.sub(prepayment);
          database.prepare("INSERT INTO obligation (id,kind,po_id,supplier_id,amount,due_at,basis) VALUES (?,?,?,?,?,?,?)")
            .run(`OB-${randomUUID()}`, "supplier_prepayment", poId, payload.supplier_id!, prepayment.amount, at, `Одобренный заказ ${poId}; ${priced.length}/${lines.length} цен известны`);
          database.prepare("INSERT INTO obligation (id,kind,po_id,supplier_id,amount,due_at,basis) VALUES (?,?,?,?,?,?,?)")
            .run(`OB-${randomUUID()}`, "supplier_balance", poId, payload.supplier_id!, balance.amount, eta, `Одобренный заказ ${poId}; ${priced.length}/${lines.length} цен известны`);
        }
      } else {
        for (const line of payload.lines ?? []) database.prepare("UPDATE recommendation SET state='rejected',version=version+1 WHERE id=?")
          .run(line.recommendation_id);
      }
    }
    return bumpStateVersion(database);
  });
  const run = payload.run_id ? database.prepare("SELECT agent_run_id FROM calc_run WHERE id=?").get(payload.run_id) as { agent_run_id: string | null } | undefined : undefined;
  const runId = run?.agent_run_id ?? await startRun({ org_id: ctx.org_id ?? "ORG-1", trigger_type: "goal", trigger_ref: id });
  await recordAction(runId, { kind: "decision", subject_ref: id,
    summary_ru: decision === "approve" ? `Одобрено предложение ${id}` : `Отклонено предложение ${id}`,
    rationale_ru: proposal.rationale_ru ?? undefined, sources: JSON.parse(proposal.sources),
    autonomy: "escalated", result: "done", idempotency_key: `decision:${id}:${proposalVersion}`,
    po_id: poId ?? undefined });
  if (!run?.agent_run_id) await finishRun(runId, "done");
  const linkedTask = database.prepare("SELECT id,state,version FROM task WHERE proposal_id=?").get(id) as { id: string; state: string; version: number } | undefined;
  if (linkedTask?.state === "needs_review") await transitionTask(linkedTask.id, decision === "approve" ? "ready_to_handover" : "preparing", linkedTask.version, { database, org_id: ctx.org_id });
  return { id, decision, proposal_version: proposalVersion + 1, po_id: poId, total_cost: totalCost, state_version: stateVersion, affected };
}
