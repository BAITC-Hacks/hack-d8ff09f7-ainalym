import { createHash, randomUUID } from "node:crypto";
import { processEvent } from "../ai/worker";
import { bumpStateVersion, db, stateVersion, withTx } from "../db/client";
import { activeOrg, getWorldEvent, WorldError } from "./feed";

export type ComposedKind = "judge_message" | "in_transit_update" | "price_update" | "supplier_reply";
export interface ComposeInput {
  kind: ComposedKind; actor_id?: string; code_1c?: string; po_id?: string;
  text: string; payload?: Record<string, unknown>; org_id?: string;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]));
  return value;
}

export async function composeEvent(input: ComposeInput) {
  const orgId = activeOrg(input.org_id);
  if (!["judge_message", "in_transit_update", "price_update", "supplier_reply"].includes(input.kind)) throw new WorldError("invalid_kind", 400);
  if (typeof input.text !== "string" || !input.text.trim() || input.text.length > 10000) throw new WorldError("invalid_text", 400);
  if (input.actor_id !== undefined && (typeof input.actor_id !== "string" || input.actor_id.length > 100)) throw new WorldError("invalid_actor", 400);
  if (input.code_1c !== undefined && (typeof input.code_1c !== "string" || !input.code_1c || input.code_1c.length > 100)) throw new WorldError("invalid_code", 400);
  if (input.po_id !== undefined && (typeof input.po_id !== "string" || !input.po_id || input.po_id.length > 100)) throw new WorldError("invalid_po", 400);
  if (input.payload !== undefined && (!input.payload || Array.isArray(input.payload) || typeof input.payload !== "object")) throw new WorldError("invalid_payload", 400);
  const payload = input.payload ?? {};
  const po = input.po_id ? db().prepare("SELECT supplier_id FROM purchase_order WHERE id = ?").get(input.po_id) as { supplier_id: string } | undefined : undefined;
  if (input.po_id && !po) throw new WorldError("unknown_po", 404);
  const codes = new Set<string>();
  const addCode = (value: unknown) => {
    if (value === undefined) return;
    if (typeof value !== "string" || !value) throw new WorldError("invalid_code", 400);
    codes.add(value);
  };
  addCode(input.code_1c);
  addCode(payload.code_1c);
  for (const key of ["line", "lines", "rows", "stocks"] as const) {
    const entries = Array.isArray(payload[key]) ? payload[key] : payload[key] ? [payload[key]] : [];
    for (const entry of entries) if (entry && typeof entry === "object" && "code_1c" in entry) addCode(entry.code_1c);
  }
  for (const code of codes) {
    const sku = db().prepare("SELECT supplier_id FROM sku WHERE code_1c = ?").get(code) as { supplier_id: string } | undefined;
    if (!sku) throw new WorldError("unknown_sku", 404);
    if ((po && po.supplier_id !== sku.supplier_id) ||
      (typeof payload.supplier_id === "string" && payload.supplier_id !== sku.supplier_id)) {
      throw new WorldError("sku_supplier_mismatch", 404);
    }
  }
  if (input.kind === "supplier_reply" && po && input.actor_id && input.actor_id !== po.supplier_id) {
    throw new WorldError("supplier_mismatch", 404);
  }
  const actorId = input.actor_id ?? (input.kind === "supplier_reply" ? "supplier" : "judge");
  const digest = createHash("sha256").update(JSON.stringify(stable([input.kind, actorId, input.code_1c ?? "", input.po_id ?? "", input.text, payload]))).digest("hex").slice(0, 24);
  const sourceId = `${input.kind === "supplier_reply" ? "SUPPLIER" : "JUDGE"}-${digest}`;
  const existing = db().prepare("SELECT id FROM world_event WHERE org_id = ? AND source_id = ?").get(orgId, sourceId) as { id: string } | undefined;
  if (existing) return { event: getWorldEvent(existing.id, orgId)!, run_id: null, replayed: true, state_version: stateVersion() };
  const id = `WE-${randomUUID()}`;
  const now = new Date().toISOString();
  let inserted = false;
  try {
    withTx((d) => {
      const seq = (d.prepare("SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM world_event WHERE org_id = ?").get(orgId) as { n: number }).n;
      d.prepare("INSERT INTO world_event (id,org_id,seq,kind,actor_id,code_1c,po_id,at,source_id,text,payload,state,emitted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .run(id, orgId, seq, input.kind, actorId, input.code_1c ?? null, input.po_id ?? null, now, sourceId, input.text, JSON.stringify(payload), "pending", now);
      bumpStateVersion(d);
      inserted = true;
    });
  } catch (error) {
    const duplicate = db().prepare("SELECT id FROM world_event WHERE org_id = ? AND source_id = ?").get(orgId, sourceId) as { id: string } | undefined;
    if (!duplicate) throw error;
    return { event: getWorldEvent(duplicate.id, orgId)!, run_id: null, replayed: true, state_version: stateVersion() };
  }
  const result = inserted ? await processEvent(id) : { run_id: null };
  return { event: getWorldEvent(id, orgId)!, run_id: result.run_id, replayed: false, state_version: stateVersion() };
}
