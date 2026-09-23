import { db, stateVersion } from "../db/client";
import { queueView } from "../domain/views";
import { skuView } from "../domain/skus";

export const toolNames = ["what_needs_me", "what_changed", "recommend_for", "explain_sku"] as const;
export type ToolName = typeof toolNames[number];
export interface ToolScope { org_id: string; supplier_id?: string; code_1c?: string }
export interface ToolCall { request_id: string; scope: ToolScope; args: Record<string, unknown> }
export interface ToolResult { ok: boolean; state_version: number; labels: Record<string, string>; replayed?: boolean; [key: string]: unknown }

const labels = { provenance: "Partner data · anonymised", ai: "Rules, no LLM", external: "Export for 1C (file)", draft: "Draft — not sent" };
const ttlSeconds = 600;
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
  if (name === "explain_sku") {
    if (!code) return { code: "invalid", message: "code_1c is required", status: 400 };
    const row = d.prepare("SELECT supplier_id FROM sku WHERE code_1c = ?").get(code) as { supplier_id: string } | undefined;
    if (!row) return { code: "unknown", message: "SKU not found", status: 404 };
    if (scope.supplier_id && row.supplier_id !== scope.supplier_id) return { code: "denied", message: "SKU is outside current supplier", status: 403 };
  }
  return null;
}

async function run(name: ToolName, call: ToolCall, origin: string): Promise<{ status: number; result: ToolResult }> {
  const d = db();
  const version = stateVersion(d);
  if (name === "what_needs_me") {
    const queue = await queueView(call.scope.org_id);
    if (queue.empty_reason === "domain pending") return err("dependency_unavailable", "Approval queue is not ready", 503, version);
    const items = queue.items.filter(own).map(item => ({ id: item.id, kind: item.kind, title: item.title, money_at_stake: item.money_at_stake, href: item.href }));
    return { status: 200, result: { ok: true, items, state_version: version, labels } };
  }
  if (name === "what_changed") {
    const since = call.args.since;
    if (since !== undefined && (!Number.isInteger(since) || Number(since) < 0)) return err("invalid", "since must be a state version", 400, version);
    if (typeof since === "number" && since > version) return err("invalid", "since is newer than current state", 400, version);
    const cursor = typeof since === "number" && since < version ? d.prepare("SELECT last_rowid FROM voice_change_cursor WHERE org_id = ? AND version = ?").get(call.scope.org_id, since) as { last_rowid: number } | undefined : undefined;
    if (typeof since === "number" && since < version && !cursor) return err("unsupported_since", "No saved cursor for that state version", 422, version);
    const rows = since === version ? [] : typeof since === "number" ? d.prepare("SELECT id, kind, subject_ref, summary_ru FROM agent_action WHERE org_id = ? AND rowid > ? ORDER BY rowid DESC LIMIT 20").all(call.scope.org_id, cursor!.last_rowid) as { id: string; kind: string; subject_ref: string | null; summary_ru: string }[] : d.prepare("SELECT id, kind, subject_ref, summary_ru FROM agent_action WHERE org_id = ? ORDER BY rowid DESC LIMIT 20").all(call.scope.org_id) as { id: string; kind: string; subject_ref: string | null; summary_ru: string }[];
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
    const recommendation = own(view.recommendation) ? view.recommendation : {};
    const forecast = own(view.forecast) ? view.forecast : null;
    const result = {
      ok: true, code_1c: code,
      rationale_ru: recommendation.rationale_ru ?? null,
      components: recommendation.components ?? {},
      outliers_excluded: view.outliers_excluded ?? [],
      stockout_months: view.stockout_months ?? [],
      forecast, state_version: version, labels,
    };
    return { status: 200, result };
  }
  const supplier = call.args.supplier_id ?? call.scope.supplier_id;
  const category = call.args.category;
  if (typeof call.args.utterance === "string" && ambiguousQuantity(call.args.utterance)) return err("needs_clarification", "Уточните количество перед расчётом.", 422, version);
  if (supplier === undefined && category === undefined) return err("invalid", "Supplier or category is required", 400, version);
  if (category !== undefined && (typeof category !== "string" || !category.trim())) return err("invalid", "Invalid category", 400, version);
  const routeScope = { ...(supplier ? { supplier } : {}), ...(category ? { category } : {}) };
  let response: Response;
  try {
    response = await fetch(new URL("/api/calc/run", origin), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: routeScope }), cache: "no-store",
    });
  } catch {
    return err("dependency_unavailable", "Calculation route is not ready", 503, version);
  }
  let body: unknown;
  try { body = await response.json(); } catch { return err("dependency_unavailable", "Calculation route returned no result", 503, version); }
  if (!response.ok || !own(body) || typeof body.run_id !== "string") return err("dependency_unavailable", "Calculation did not confirm a run", 503, version);
  const top = d.prepare("SELECT code_1c, qty_recommended AS qty, urgency FROM recommendation WHERE run_id = ? ORDER BY qty_recommended DESC LIMIT 5").all(body.run_id);
  return { status: 200, result: { ok: true, run_id: body.run_id, recommended: body.recommended, top, state_version: stateVersion(d), labels } };
}

export async function executeVoiceTool(name: string, raw: unknown, origin = "http://localhost"): Promise<{ status: number; result: ToolResult }> {
  if (!toolNames.includes(name as ToolName)) return err("unknown_tool", "Unknown voice tool", 404);
  if (!own(raw) || typeof raw.request_id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(raw.request_id) || !own(raw.scope) || typeof raw.scope.org_id !== "string" || !raw.scope.org_id || !own(raw.args)) return err("invalid", "Invalid tool call", 400);
  const call = raw as unknown as ToolCall;
  const scopeIssue = scopeError(call.scope, name as ToolName, call.args);
  if (scopeIssue) return err(scopeIssue.code, scopeIssue.message, scopeIssue.status);
  init();
  const d = db();
  const now = Math.floor(Date.now() / 1000);
  d.prepare("DELETE FROM voice_tool_call WHERE expires_at <= ?").run(now);
  const scopeJson = JSON.stringify(call.scope);
  const argsJson = JSON.stringify(call.args);
  const insert = d.prepare("INSERT OR IGNORE INTO voice_tool_call (request_id, tool, scope_json, args_json, expires_at, state) VALUES (?, ?, ?, ?, ?, 'pending')").run(call.request_id, name, scopeJson, argsJson, now + ttlSeconds);
  if (!insert.changes) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const row = d.prepare("SELECT tool, scope_json, args_json, state, result_json FROM voice_tool_call WHERE request_id = ?").get(call.request_id) as { tool: string; scope_json: string; args_json: string; state: string; result_json: string | null };
      if (row.tool !== name || row.scope_json !== scopeJson || row.args_json !== argsJson) return err("request_conflict", "request_id belongs to another call", 409);
      if (row.state === "done" && row.result_json) {
        const saved = JSON.parse(row.result_json) as { status: number; result: ToolResult };
        return { status: saved.status, result: { ...saved.result, replayed: true } };
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return err("request_pending", "Original call is still in progress", 409);
  }
  let executed: { status: number; result: ToolResult };
  try { executed = await run(name as ToolName, call, origin); }
  catch { executed = err("tool_unavailable", "Tool execution failed", 503); }
  d.prepare("UPDATE voice_tool_call SET state = 'done', result_json = ? WHERE request_id = ?").run(JSON.stringify(executed), call.request_id);
  return executed;
}
