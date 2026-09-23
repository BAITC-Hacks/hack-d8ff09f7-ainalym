import { db, stateVersion } from "../db/client";

export const WORLD_LABEL = "Симулятор мира — синтетическое событие";
export const WORLD_EXTERNAL = "local_simulator";

export class WorldError extends Error {
  constructor(public code: string, public status: number, message = code) { super(message); }
}

export type WorldState = "scripted" | "pending" | "processed" | "replayed" | "failed";
export interface WorldRow {
  id: string; org_id: string; seq: number | null; kind: string; actor_id: string | null;
  code_1c: string | null; po_id: string | null; at: string | null; source_id: string;
  text: string | null; payload: Record<string, unknown>; state: WorldState;
  run_id: string | null; emitted_at: string | null; processed_at: string | null;
  label: typeof WORLD_LABEL; external: typeof WORLD_EXTERNAL;
}

export function activeOrg(orgId?: string): string {
  const row = db().prepare("SELECT id FROM organization ORDER BY rowid LIMIT 1").get() as { id: string } | undefined;
  if (!row || (orgId && orgId !== row.id)) throw new WorldError("unknown_org", 404);
  return row.id;
}

export function mapWorldRow(row: Record<string, unknown>): WorldRow {
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(String(row.payload || "{}")); } catch { /* preserve event text even if an old payload is invalid */ }
  return { ...row, payload, label: WORLD_LABEL, external: WORLD_EXTERNAL } as unknown as WorldRow;
}

export function getWorldEvent(id: string, orgId = activeOrg()): WorldRow | null {
  const row = db().prepare("SELECT * FROM world_event WHERE id = ? AND org_id = ?").get(id, orgId) as Record<string, unknown> | undefined;
  return row ? mapWorldRow(row) : null;
}

export function feed(input: { state?: WorldState; code?: string; org_id?: string } = {}) {
  const orgId = activeOrg(input.org_id);
  if (input.state && !["scripted", "pending", "processed", "replayed", "failed"].includes(input.state)) {
    throw new WorldError("invalid_state", 400);
  }
  const rows = db().prepare(
    "SELECT * FROM world_event WHERE org_id = ? AND (? IS NULL OR state = ?) AND (? IS NULL OR code_1c = ?) ORDER BY CASE WHEN seq IS NULL THEN 1 ELSE 0 END, seq, at, id"
  ).all(orgId, input.state ?? null, input.state ?? null, input.code ?? null, input.code ?? null) as Record<string, unknown>[];
  return { rows: rows.map(mapWorldRow), state_version: stateVersion() };
}
