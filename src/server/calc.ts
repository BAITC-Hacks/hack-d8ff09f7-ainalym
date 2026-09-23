import { randomUUID } from "node:crypto";
import { bumpStateVersion, db, withTx } from "@/db/client";
import { computeNeed, type EngineParams } from "@/domain/engine";
import { applyRecommendations } from "@/domain/apply";
import { finishRun, recordAction, startRun } from "./ledger";
import { orgId } from "./context";
import type { CalcRunRequest } from "./contracts";

export async function runCalculation(request: CalcRunRequest) {
  const d = db();
  const clauses: string[] = [];
  const values: string[] = [];
  if (request.scope.supplier) { clauses.push("supplier_id = ?"); values.push(request.scope.supplier); }
  if (request.scope.category) { clauses.push("category = ?"); values.push(request.scope.category); }
  const codes = d.prepare(`SELECT code_1c, supplier_id FROM sku ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY code_1c`).all(...values) as { code_1c: string; supplier_id: string }[];
  const suppliers = new Map((d.prepare("SELECT * FROM supplier").all() as { id: string; lead_time_days: number; review_days: number }[]).map(s => [s.id, s]));
  const id = `RUN-${randomUUID()}`;
  const agentRunId = await startRun({ org_id: orgId(), trigger_type: "calc_request", trigger_ref: id });
  try {
    const computed: { sku: (typeof codes)[number]; result: Awaited<ReturnType<typeof computeNeed>>; params: EngineParams }[] = [];
    for (const sku of codes) {
      const supplier = suppliers.get(sku.supplier_id);
      if (!supplier) continue;
      const params: EngineParams = {
        lead_time_days: supplier.lead_time_days, review_days: supplier.review_days,
        service_level: 0.9, growth_cap: 0.5, outlier: { k_month: 3, k_doc: 5, min_units: 20 },
        ...(request.params || {}),
      };
      computed.push({ sku, result: await computeNeed(sku.code_1c, params), params });
    }
    const recommended = computed.filter(item => Number.isFinite(item.result.need) && item.result.need > 0).length;
    const now = new Date().toISOString();
    withTx(tx => {
      tx.prepare("INSERT INTO calc_run (id,scope,params,started_at,finished_at,skus,recommended,agent_run_id) VALUES (?,?,?,?,?,?,?,?)")
        .run(id, JSON.stringify(request.scope), JSON.stringify(request.params || {}), now, now, codes.length, recommended, agentRunId);
      const insertForecast = tx.prepare(`INSERT INTO forecast (id,run_id,code_1c,horizon_months,base_rate,season,growth,stockout_uplift,safety,method_ru)
        VALUES (?,?,?,?,?,?,?,?,?,?)`);
      const insertRec = tx.prepare(`INSERT INTO recommendation (id,run_id,code_1c,supplier_id,qty_recommended,on_hand,in_transit,forecast_id,urgency,rationale_ru,components)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
      for (const { sku, result } of computed) {
        const qty = Math.max(0, Math.ceil(result.need));
        const forecast = result.forecast;
        const f = forecast && typeof forecast === "object" ? forecast : null;
        const forecastId = f ? `FC-${randomUUID()}` : null;
        if (f) insertForecast.run(forecastId, id, sku.code_1c, Number(f.horizon_months || 1), String(f.base_rate ?? "0"),
          JSON.stringify(f.season || {}), String(f.growth ?? "1"), String(f.stockout_uplift ?? "0"), String(f.safety ?? "0"), String(f.method_ru || result.rationale_ru));
        if (qty > 0) insertRec.run(`REC-${randomUUID()}`, id, sku.code_1c, sku.supplier_id, qty,
          String(result.components.on_hand ?? "0"), String(result.components.in_transit ?? "0"), forecastId,
          String(result.components.urgency || "normal"), result.rationale_ru, JSON.stringify(result.components));
      }
      bumpStateVersion(tx);
    });
    await recordAction(agentRunId, { kind: "recompute", subject_ref: id, summary_ru: `Расчёт: ${codes.length} SKU`, sources: ["sku", "sales_month", "stock_month", "in_transit"], idempotency_key: `calc:${id}` });
    const applied = await applyRecommendations(id);
    await finishRun(agentRunId, "done");
    return { run_id: id, skus: codes.length, recommended, proposals: applied.proposals };
  } catch (error) {
    await finishRun(agentRunId, "failed");
    throw error;
  }
}
