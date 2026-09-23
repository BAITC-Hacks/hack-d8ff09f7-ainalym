import { db, stateVersion } from "../db/client";
import { queueView } from "../domain/views";
import { skuView } from "../domain/skus";
import { runCalculation } from "../domain/apply";

export const toolNames = ["what_needs_me", "what_changed", "recommend_for", "explain_sku"] as const;
export type ToolName = typeof toolNames[number];
export interface ToolScope { org_id: string; supplier_id?: string; code_1c?: string }
export interface ToolCall { request_id: string; scope: ToolScope; args: Record<string, unknown> }
export interface ToolResult { ok: boolean; state_version: number; labels: Record<string, string>; replayed?: boolean; [key: string]: unknown }

const labels = { provenance: "Partner data · anonymised", ai: "Rules, no LLM", external: "Export for 1C (file)" };
const draftLabels = { ...labels, draft: "Draft — not sent" };
const ttlSeconds = 600;
const pendingExecutions = new Map<string, Promise<{ status: number; result: ToolResult }>>();
const own = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const err = (code: string, message: string, status: number, version = stateVersion()) => ({ status, result: { ok: false, code, message, state_version: version, labels } as ToolResult });
export function ambiguousQuantity(text: string): boolean {
  const values = text.toLowerCase().match(/\d+(?:[\s.,]\d+)*|(?:ноль|один|одна|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать|тринадцать|четырнадцать|пятнадцать|двадцать|тридцать|сорок|тысяч[аиу]?)/g) ?? [];
  return values.length >= 2 && new Set(values.map(value => value.replace(/\s+/g, ""))).size > 1 && /(?:нет|то есть|ой|поправка|вернее)/i.test(text);
}

function init() {
  db().exec(`CREATE TABLE IF NOT EXISTS voice_tool_call (
    request_id TEXT PRIMARY KEY, tool TEXT NOT NULL, scope_json TEXT NOT NULL, args_json TEXT NOT NULL,
    expires_at INTEGER NOT NULL, state TEXT NOT NULL, result_json TEXT
  )`);
  db().exec(`CREATE TABLE IF NOT EXISTS voice_change_cursor (
    org_id TEXT NOT NULL, version INTEGER NOT NULL, last_rowid INTEGER NOT NULL,
    PRIMARY KEY (org_id, version)
  )`);
}

function scopeError(scope: ToolScope, name: ToolName, args: Record<string, unknown>): { code: string; message: string; status: number } | null {
  const d = db();
  if (!d.prepare("SELECT 1 FROM organization WHERE id = ?").get(scope.org_id)) return { code: "denied", message: "Unknown organization scope", status: 403 };
  const supplier = typeof args.supplier_id === "string" ? args.supplier_id : scope.supplier_id;
  if (scope.supplier_id && supplier && supplier !== scope.supplier_id) return { code: "denied", message: "Supplier is outside current scope", status: 403 };
  if (supplier && !d.prepare("SELECT 1 FROM supplier WHERE id = ?").get(supplier)) return { code: "unknown", message: "Supplier not found", status: 404 };
  const code = typeof args.code_1c === "string" ? args.code_1c : scope.code_1c;
  if (scope.code_1c && code && code !== scope.code_1c) return { code: "denied", message: "SKU is outside current scope", status: 403 };
  if (name === "explain_sku" && !code) return { code: "invalid", message: "code_1c is required", status: 400 };
  if (code) {
    const row = d.prepare("SELECT supplier_id FROM sku WHERE code_1c = ?").get(code) as { supplier_id: string } | undefined;
    if (!row) return { code: "unknown", message: "SKU not found", status: 404 };
    if (scope.supplier_id && row.supplier_id !== scope.supplier_id) return { code: "denied", message: "SKU is outside current supplier", status: 403 };
  }
  return null;
}

async function run(name: ToolName, call: ToolCall): Promise<{ status: number; result: ToolResult }> {
  const d = db();
  const version = stateVersion(d);
  if (name === "what_needs_me") {
    const queue = await queueView(call.scope.org_id);
    if (queue.empty_reason === "domain pending") return err("dependency_unavailable", "Approval queue is not ready", 503, version);
    let allowed: Set<string> | undefined;
    if (call.scope.supplier_id || call.scope.code_1c) {
      const proposalIds = call.scope.code_1c
        ? d.prepare("SELECT DISTINCT proposal_id AS id FROM recommendation WHERE code_1c = ? AND proposal_id IS NOT NULL").all(call.scope.code_1c) as { id: string }[]
        : d.prepare("SELECT id FROM proposal WHERE subject_id = ?").all(call.scope.supplier_id!) as { id: string }[];
      allowed = new Set(proposalIds.map(row => row.id));
      for (const proposalId of proposalIds) {
        const tasks = d.prepare("SELECT id FROM task WHERE proposal_id = ?").all(proposalId.id) as { id: string }[];
        tasks.forEach(task => allowed!.add(task.id));
      }
    }
    const items = queue.items.filter(own).filter(item => !allowed || allowed.has(String(item.id))).map(item => ({ id: item.id, kind: item.kind, title: item.title, money_at_stake: item.money_at_stake, href: item.href }));
    return { status: 200, result: { ok: true, items, state_version: version, labels } };
  }
  if (name === "what_changed") {
    const since = call.args.since;
    if (since !== undefined && (!Number.isInteger(since) || Number(since) < 0)) return err("invalid", "since must be a state version", 400, version);
    if (typeof since === "number" && since > version) return err("invalid", "since is newer than current state", 400, version);
    const cursor = typeof since === "number" && since < version ? d.prepare("SELECT last_rowid FROM voice_change_cursor WHERE org_id = ? AND version = ?").get(call.scope.org_id, since) as { last_rowid: number } | undefined : undefined;
    if (typeof since === "number" && since < version && !cursor) return err("unsupported_since", "No saved cursor for that state version", 422, version);
    const scopeSql = call.scope.code_1c ? " AND code_1c = ?" : call.scope.supplier_id ? " AND (subject_ref = ? OR code_1c IN (SELECT code_1c FROM sku WHERE supplier_id = ?) OR po_id IN (SELECT id FROM purchase_order WHERE supplier_id = ?))" : "";
    const scopeArgs = call.scope.code_1c ? [call.scope.code_1c] : call.scope.supplier_id ? [call.scope.supplier_id, call.scope.supplier_id, call.scope.supplier_id] : [];
    const rows = since === version ? [] : typeof since === "number" ? d.prepare(`SELECT id, kind, subject_ref, summary_ru FROM agent_action WHERE org_id = ? AND rowid > ?${scopeSql} ORDER BY rowid DESC LIMIT 20`).all(call.scope.org_id, cursor!.last_rowid, ...scopeArgs) as { id: string; kind: string; subject_ref: string | null; summary_ru: string }[] : d.prepare(`SELECT id, kind, subject_ref, summary_ru FROM agent_action WHERE org_id = ?${scopeSql} ORDER BY rowid DESC LIMIT 20`).all(call.scope.org_id, ...scopeArgs) as { id: string; kind: string; subject_ref: string | null; summary_ru: string }[];
    const latest = d.prepare("SELECT COALESCE(MAX(rowid), 0) AS n FROM agent_action WHERE org_id = ?").get(call.scope.org_id) as { n: number };
    d.prepare("INSERT OR IGNORE INTO voice_change_cursor (org_id, version, last_rowid) VALUES (?, ?, ?)").run(call.scope.org_id, version, latest.n);
    const changes = rows.map(row => ({ object: row.kind, id: row.subject_ref ?? row.id, field: "summary_ru", before: null, after: row.summary_ru }));
    const summary_ru = rows.length ? rows.map(row => row.summary_ru).join("; ") : "Подтверждённых действий агента пока нет.";
    return { status: 200, result: { ok: true, summary_ru, changes, state_version: version, labels } };
  }
  if (name === "explain_sku") {
    const code = String(call.args.code_1c ?? call.scope.code_1c);
    const view = await skuView(code);
    if (!view) return err("dependency_unavailable", "SKU view is not ready", 503, version);
    if (!own(view.recommendation)) return err("no_recommendation", "Для этого товара ещё нет сохранённого расчёта", 422, version);
    const recommendation = view.recommendation;
    let components: Record<string, unknown> = {};
    try { components = typeof recommendation.components === "string" ? JSON.parse(recommendation.components) as Record<string, unknown> : own(recommendation.components) ? recommendation.components : {}; }
    catch { return err("invalid_record", "Saved recommendation components are invalid", 503, version); }
    const series = Array.isArray(view.series) ? view.series.filter(own) : [];
    const outliers = Array.isArray(components.outliers_excluded) ? components.outliers_excluded : series.flatMap(month => Array.isArray(month.outliers) ? month.outliers.filter(own).filter(row => row.state === "excluded") : []);
    const stockoutMonths = Array.isArray(components.stockout_months) ? components.stockout_months : series.filter(month => month.stockout === 1).map(month => month.ym);
    const forecast = own(view.forecast) ? view.forecast : null;
    const result = {
      ok: true, code_1c: code,
      rationale_ru: recommendation.rationale_ru ?? null,
      components,
      outliers_excluded: outliers,
      stockout_months: stockoutMonths,
      forecast, state_version: version, labels,
    };
    return { status: 200, result };
  }
  const supplier = call.args.supplier_id ?? call.scope.supplier_id;
  const category = call.args.category;
  if (call.args.expected_state_version !== undefined && (!Number.isInteger(call.args.expected_state_version) || call.args.expected_state_version !== version)) return err("stale", "State changed; refresh before calculating", 409, version);
  if (typeof call.args.utterance === "string" && ambiguousQuantity(call.args.utterance)) return err("needs_clarification", "Уточните количество перед расчётом.", 422, version);
  if (supplier === undefined && category === undefined) return err("invalid", "Supplier or category is required", 400, version);
  if (category !== undefined && (typeof category !== "string" || !category.trim())) return err("invalid", "Invalid category", 400, version);
  const routeScope = { ...(supplier ? { supplier: String(supplier) } : {}), ...(category ? { category: String(category) } : {}), ...(call.scope.code_1c ? { codes: [call.scope.code_1c] } : {}) };
  let calculated: Awaited<ReturnType<typeof runCalculation>>;
  try {
    calculated = await runCalculation(routeScope, {}, { org_id: call.scope.org_id });
  } catch {
    return err("dependency_unavailable", "Calculation could not complete", 503, version);
  }
  const top = d.prepare("SELECT code_1c, qty_recommended AS qty, urgency FROM recommendation WHERE run_id = ? AND qty_recommended > 0 ORDER BY qty_recommended DESC LIMIT 5").all(calculated.run_id);
  return { status: 200, result: { ok: true, run_id: calculated.run_id, recommended: calculated.recommended, top, proposal_ids: calculated.proposals.map(row => row.id), task_ids: calculated.tasks.map(row => row.id), state_version: stateVersion(d), labels: calculated.proposals.length ? draftLabels : labels } };
}

export async function executeVoiceTool(name: string, raw: unknown): Promise<{ status: number; result: ToolResult }> {
  if (!toolNames.includes(name as ToolName)) return err("unknown_tool", "Unknown voice tool", 404);
  if (!own(raw) || typeof raw.request_id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(raw.request_id) || !own(raw.scope) || typeof raw.scope.org_id !== "string" || !raw.scope.org_id || !own(raw.args)) return err("invalid", "Invalid tool call", 400);
  const call = raw as unknown as ToolCall;
  init();
  const d = db();
  const now = Math.floor(Date.now() / 1000);
  d.prepare("DELETE FROM voice_tool_call WHERE expires_at <= ?").run(now);
  const scopeJson = JSON.stringify({ org_id: call.scope.org_id, supplier_id: call.scope.supplier_id ?? null, code_1c: call.scope.code_1c ?? null });
  const argsJson = JSON.stringify(call.args);
  const existing = d.prepare("SELECT scope_json FROM voice_tool_call WHERE request_id = ?").get(call.request_id) as { scope_json: string } | undefined;
  if (!existing) {
    const scopeIssue = scopeError(call.scope, name as ToolName, call.args);
    if (scopeIssue) return err(scopeIssue.code, scopeIssue.message, scopeIssue.status);
  }
  const insert = d.prepare("INSERT OR IGNORE INTO voice_tool_call (request_id, tool, scope_json, args_json, expires_at, state) VALUES (?, ?, ?, ?, ?, 'pending')").run(call.request_id, name, scopeJson, argsJson, now + ttlSeconds);
  if (!insert.changes) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const row = d.prepare("SELECT scope_json, state, result_json FROM voice_tool_call WHERE request_id = ?").get(call.request_id) as { scope_json: string; state: string; result_json: string | null };
      if (row.scope_json !== scopeJson) return err("request_conflict", "request_id belongs to another scope", 409);
      if (row.state === "done" && row.result_json) {
        const saved = JSON.parse(row.result_json) as { status: number; result: ToolResult };
        return { status: saved.status, result: { ...saved.result, replayed: true } };
      }
      const pending = pendingExecutions.get(call.request_id);
      if (pending) {
        const saved = await pending;
        return { status: saved.status, result: { ...saved.result, replayed: true } };
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return err("request_pending", "Original call is still in progress", 409);
  }
  const execution = Promise.resolve().then(async () => {
    let executed: { status: number; result: ToolResult };
    try { executed = await run(name as ToolName, call); }
    catch { executed = err("tool_unavailable", "Tool execution failed", 503); }
    d.prepare("UPDATE voice_tool_call SET state = 'done', result_json = ? WHERE request_id = ?").run(JSON.stringify(executed), call.request_id);
    return executed;
  });
  pendingExecutions.set(call.request_id, execution);
  try { return await execution; }
  finally { pendingExecutions.delete(call.request_id); }
}
