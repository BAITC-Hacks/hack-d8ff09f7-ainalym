import { createHash, randomUUID } from "node:crypto";
import { db, stateVersion, withTx, bumpStateVersion } from "../db/client";
import { catalogQuestion } from "./catalog";
import { decideChoice, selectedProvider, type ChoiceResult } from "./provider";

export interface DecisionRecord extends ChoiceResult {
  id: string;
  question_id: string;
  subject_ref: string;
  evidence_versions: Record<string, number>;
  rubric_version: string;
  mode: "live" | "rules" | "replay";
  cache_key: string;
  at: string;
}

function ensureColumns(): void {
  const d = db();
  const existing = new Set((d.prepare("PRAGMA table_info(decision_record)").all() as { name: string }[]).map(c => c.name));
  for (const [name, ddl] of [
    ["evidence_versions", "TEXT NOT NULL DEFAULT '{}'"],
    ["rubric_version", "TEXT NOT NULL DEFAULT ''"],
    ["cache_key", "TEXT NOT NULL DEFAULT ''"],
  ]) if (!existing.has(name)) d.exec(`ALTER TABLE decision_record ADD COLUMN ${name} ${ddl}`);
  d.exec("CREATE INDEX IF NOT EXISTS decision_record_cache ON decision_record(cache_key)");
}

function sanitized(value: unknown, orgId: string | null): unknown {
  if (Array.isArray(value)) return value.map(v => sanitized(v, orgId)).filter(v => v !== undefined);
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    const owner = item.org_id ?? item.tenant_id;
    if (owner !== undefined && (!orgId || String(owner) !== orgId)) return undefined;
    return Object.fromEntries(Object.entries(item)
      .filter(([key]) => !["api_key", "secret", "authorization", "credential"].includes(key.toLowerCase()))
      .map(([key, child]) => [key, sanitized(child, orgId)])
      .filter(([, child]) => child !== undefined));
  }
  return value;
}

export function sanitizeDecisionContext(context: unknown): unknown {
  if (!context || typeof context !== "object" || Array.isArray(context)) return context;
  const input = context as Record<string, unknown>;
  const orgId = typeof input.org_id === "string" ? input.org_id : typeof input.tenant_id === "string" ? input.tenant_id : null;
  return sanitized(input, orgId);
}

function versionsFor(subject_ref: string, context: Record<string, unknown>): Record<string, number> {
  const supplied = context.subject_versions ?? context.evidence_versions;
  const versions: Record<string, number> = {};
  if (supplied && typeof supplied === "object" && !Array.isArray(supplied)) {
    for (const [key, value] of Object.entries(supplied)) if (typeof value === "number" && Number.isInteger(value)) versions[key] = value;
  }
  const skuCode = subject_ref.startsWith("sku:") ? subject_ref.slice(4) : subject_ref;
  const sku = db().prepare("SELECT version FROM sku WHERE code_1c = ?").get(skuCode) as { version: number } | undefined;
  if (sku) versions[`sku:${skuCode}`] = sku.version;
  if (Object.keys(versions).length === 0) versions.state = stateVersion();
  return versions;
}

function cacheKey(question_id: string, subject_ref: string, versions: Record<string, number>, rubric: string, model: string): string {
  const sorted = Object.fromEntries(Object.entries(versions).sort(([a], [b]) => a.localeCompare(b)));
  return createHash("sha256").update(JSON.stringify({ question_id, subject_ref, versions: sorted, rubric, model })).digest("hex");
}

function modelHint(provider: string): string | null {
  if (provider === "rules") return "rules-v1";
  if (provider === "offline") return "recorded-v1";
  return null; // Live aliases may change; store the resolved model returned by the provider.
}

function fromRow(row: Record<string, unknown>): DecisionRecord {
  return {
    id: String(row.id), question_id: String(row.question_id), subject_ref: String(row.subject_ref),
    answer: row.answer == null ? null : String(row.answer),
    distribution: JSON.parse(String(row.distribution)), provider: String(row.provider),
    model_version: String(row.model_version), result_state: row.result_state as DecisionRecord["result_state"],
    mode: row.mode as DecisionRecord["mode"],
    evidence_versions: JSON.parse(String(row.evidence_versions || "{}")), rubric_version: String(row.rubric_version || ""),
    cache_key: String(row.cache_key || ""), at: String(row.at),
  };
}

export async function decide(question_id: string, subject_ref: string, context: unknown): Promise<DecisionRecord> {
  ensureColumns();
  const question = catalogQuestion(question_id);
  const mode = selectedProvider() === "offline" ? "replay" : selectedProvider() === "rules" ? "rules" : "live";
  const clean = sanitizeDecisionContext(context);
  const input = clean && typeof clean === "object" && !Array.isArray(clean) ? clean as Record<string, unknown> : {};
  const versions = versionsFor(subject_ref, input);
  const rubric = question?.rubric_version ?? "unsupported";
  const hint = modelHint(selectedProvider());
  const missingRequired = question && (question.required_input_context ?? []).some(key => input[key] === undefined || input[key] === null || input[key] === "");
  if (hint && question && !missingRequired) {
    const key = cacheKey(question_id, subject_ref, versions, rubric, hint);
    const row = db().prepare("SELECT * FROM decision_record WHERE cache_key = ? AND result_state = 'decided' ORDER BY at DESC LIMIT 1").get(key) as Record<string, unknown> | undefined;
    if (row) return fromRow(row);
  }
  let result: ChoiceResult;
  if (!question) result = { answer: null, distribution: {}, provider: "catalog", model_version: "none", result_state: "unsupported" };
  else if (missingRequired) {
    result = { answer: null, distribution: {}, provider: "catalog", model_version: "none", result_state: "insufficient" };
  } else {
    const providerContext = mode === "replay" ? { ...input, _replay_subject_ref: subject_ref } : input;
    result = await decideChoice(question, providerContext);
  }
  // A model response to an older SKU or inbox state is never accepted as a current judgment.
  const current = versionsFor(subject_ref, input);
  if (JSON.stringify(current) !== JSON.stringify(versions)) {
    result = { answer: null, distribution: {}, provider: result.provider, model_version: result.model_version, result_state: "insufficient", label: result.label };
  }
  const key = cacheKey(question_id, subject_ref, versions, rubric, result.model_version);
  const record: DecisionRecord = {
    ...result, id: `DR-${randomUUID()}`, question_id, subject_ref, evidence_versions: versions,
    rubric_version: rubric, mode, cache_key: key, at: new Date().toISOString(),
  };
  withTx(tx => {
    tx.prepare(`INSERT INTO decision_record
      (id, question_id, subject_ref, answer, distribution, provider, model_version, result_state, mode, at, evidence_versions, rubric_version, cache_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        record.id, question_id, subject_ref, record.answer, JSON.stringify(record.distribution), record.provider,
        record.model_version, record.result_state, mode, record.at, JSON.stringify(versions), rubric, key,
      );
    bumpStateVersion(tx);
  });
  return record;
}
