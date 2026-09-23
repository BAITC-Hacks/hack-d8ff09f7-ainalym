import type { DatabaseSync } from "node:sqlite";
import { bumpStateVersion, db, withTx } from "../client";

export type SqlValue = string | number | bigint | null | Uint8Array;
export interface Tables {
  organization: { id: string; name: string; payload: string };
  supplier: { id: string; name: string; lead_time_days: number; review_days: number; terms: string; currency: string; version: number };
  sku: { code_1c: string; supplier_id: string; article: string | null; name: string; unit: string | null; category: string | null; unit_cost: string | null; moq: number; weight: string | null; first_sale_ym: string | null; months_with_sales: number | null; median_month_qty: string | null; p95_doc_qty: string | null; on_hand_qty: string | null; on_hand_as_of: string | null; version: number };
  sales_line: { id: number; code_1c: string; doc_no: string | null; doc_type: string | null; at: string; warehouse: string | null; qty: string; source: string };
  sales_month: { code_1c: string; ym: string; qty_file: string | null; qty_lines: string | null; qty_regular: string | null; stockout: number };
  stock_month: { code_1c: string; ym: string; opening_qty: string | null; known: number };
  in_transit: { id: number; code_1c: string; po_ref: string; qty: string; expected_at: string | null; source_file: string | null };
  seasonality: { supplier_id: string; year: number; month: number; revenue_kzt: string | null };
  season_index: { supplier_id: string; month: number; idx: string };
  outlier_doc: { id: number; code_1c: string; doc_no: string | null; at: string | null; qty: string; rule: string; stat: string; decision: string; state: string; run_id: string | null };
  forecast: { id: string; run_id: string; code_1c: string; horizon_months: number; base_rate: string; season: string; growth: string; stockout_uplift: string; safety: string; method_ru: string | null; version: number };
  calc_run: { id: string; scope: string; params: string; started_at: string; finished_at: string | null; skus: number; recommended: number; agent_run_id: string | null };
  recommendation: { id: string; run_id: string; code_1c: string; supplier_id: string; qty_recommended: number; qty_adjusted: number | null; adjust_reason: string | null; on_hand: string; in_transit: string; forecast_id: string | null; urgency: string; rationale_ru: string; components: string; state: string; proposal_id: string | null; version: number };
  purchase_order: { id: string; supplier_id: string; run_id: string | null; state: string; total_qty: number; total_cost: string | null; cost_known_lines: number; eta: string | null; export_path: string | null; version: number };
  purchase_order_line: { id: number; po_id: string; code_1c: string; qty: number; unit_cost: string | null; rationale_ru: string | null };
  proposal: { id: string; kind: string; subject_type: string | null; subject_id: string | null; subject_version: number | null; payload: string; affects: string; supersedes_id: string | null; state: string; rationale_ru: string | null; sources: string; money_at_stake: string | null; version: number; created_at: string };
  approval: { id: string; proposal_id: string; proposal_version: number; decision: string; adjustments: string | null; by: string | null; at: string };
  task: { id: string; title: string; state: string; owner_role: string | null; proposal_id: string | null; next_event_at: string | null; updated_at: string; version: number };
  obligation: { id: string; kind: string; po_id: string | null; supplier_id: string | null; amount: string; currency: string; due_at: string | null; state: string; basis: string | null; version: number };
  payment: { id: string; direction: string; counterparty_id: string | null; amount: string; currency: string; payment_ref: string; at: string };
  world_event: { id: string; org_id: string; seq: number | null; kind: string; actor_id: string | null; code_1c: string | null; po_id: string | null; at: string | null; source_id: string; text: string | null; payload: string; state: string; run_id: string | null; emitted_at: string | null; processed_at: string | null };
  agent_run: { id: string; org_id: string; trigger_type: string; trigger_ref: string | null; state: string; started_at: string; finished_at: string | null; actions_count: number; escalations_count: number };
  agent_action: { id: string; run_id: string; org_id: string; world_event_id: string | null; code_1c: string | null; po_id: string | null; kind: string; subject_ref: string | null; summary_ru: string; rationale_ru: string | null; sources: string; autonomy: string; result: string; provider: string | null; model_version: string | null; idempotency_key: string | null; at: string };
  decision_record: { id: string; question_id: string; subject_ref: string | null; answer: string | null; distribution: string; provider: string | null; model_version: string | null; result_state: string; mode: string; at: string };
  ledger_peer_record: { id: string; peer: string; external_identity: string; kind: string | null; payload: string; version: number; state: string; as_of: string };
}

export type TableName = keyof Tables;
const keys: { [K in TableName]: readonly (keyof Tables[K] & string)[] } = {
  organization: ["id"], supplier: ["id"], sku: ["code_1c"], sales_line: ["id"],
  sales_month: ["code_1c", "ym"], stock_month: ["code_1c", "ym"], in_transit: ["id"],
  seasonality: ["supplier_id", "year", "month"], season_index: ["supplier_id", "month"],
  outlier_doc: ["id"], forecast: ["id"], calc_run: ["id"], recommendation: ["id"],
  purchase_order: ["id"], purchase_order_line: ["id"], proposal: ["id"], approval: ["id"],
  task: ["id"], obligation: ["id"], payment: ["id"], world_event: ["id"],
  agent_run: ["id"], agent_action: ["id"], decision_record: ["id"], ledger_peer_record: ["id"],
};

export class Repository<K extends TableName> {
  constructor(readonly table: K) {}
  private columns(d: DatabaseSync): Set<string> {
    return new Set((d.prepare(`PRAGMA table_info(${this.table})`).all() as { name: string }[]).map(r => r.name));
  }
  private fields(input: Record<string, SqlValue>, d: DatabaseSync): string[] {
    const columns = this.columns(d);
    const fields = Object.keys(input);
    if (!fields.length || fields.some(k => !columns.has(k))) throw new Error(`Invalid ${this.table} fields`);
    return fields;
  }
  private key(input: SqlValue | Record<string, SqlValue>): Record<string, SqlValue> {
    const names = keys[this.table];
    if (typeof input === "object" && input !== null && !(input instanceof Uint8Array)) {
      if (names.some(k => !(k in input))) throw new Error(`Missing ${this.table} key`);
      return input;
    }
    if (names.length !== 1) throw new Error(`Composite ${this.table} key required`);
    return { [names[0]]: input };
  }
  get(input: SqlValue | Record<string, SqlValue>, d: DatabaseSync = db()): Tables[K] | null {
    const where = this.key(input);
    const fields = this.fields(where, d);
    return (d.prepare(`SELECT * FROM ${this.table} WHERE ${fields.map(k => `${k} = ?`).join(" AND ")}`).get(...fields.map(k => where[k])) as Tables[K] | undefined) ?? null;
  }
  list(filter: Partial<Tables[K]> = {}, limit = 100, d: DatabaseSync = db()): Tables[K][] {
    const where = filter as Record<string, SqlValue>;
    const fields = Object.keys(where).length ? this.fields(where, d) : [];
    const sql = `SELECT * FROM ${this.table}${fields.length ? ` WHERE ${fields.map(k => `${k} = ?`).join(" AND ")}` : ""} LIMIT ?`;
    return d.prepare(sql).all(...fields.map(k => where[k]), Math.max(1, Math.min(limit, 10000))) as unknown as Tables[K][];
  }
  insert(input: Partial<Tables[K]>, d?: DatabaseSync): Tables[K] {
    const work = (tx: DatabaseSync) => {
      const row = input as Record<string, SqlValue>;
      const fields = this.fields(row, tx);
      tx.prepare(`INSERT INTO ${this.table} (${fields.join(", ")}) VALUES (${fields.map(() => "?").join(", ")})`).run(...fields.map(k => row[k]));
      bumpStateVersion(tx);
      const key = Object.fromEntries(keys[this.table].map(k => [k, row[k]]));
      if (Object.values(key).some(v => v === undefined)) {
        const id = tx.prepare("SELECT last_insert_rowid() AS id").get() as { id: number };
        return this.get(id.id, tx)!;
      }
      return this.get(key, tx)!;
    };
    return d ? work(d) : withTx(work);
  }
  update(inputKey: SqlValue | Record<string, SqlValue>, patch: Partial<Tables[K]>, d?: DatabaseSync): Tables[K] | null {
    const work = (tx: DatabaseSync) => {
      const where = this.key(inputKey);
      const row = patch as Record<string, SqlValue>;
      const fields = this.fields(row, tx);
      const whereFields = this.fields(where, tx);
      if (fields.some(k => keys[this.table].includes(k as never) || k === "version")) throw new Error("Key/version cannot be patched");
      const version = this.columns(tx).has("version") ? ", version = version + 1" : "";
      const result = tx.prepare(`UPDATE ${this.table} SET ${fields.map(k => `${k} = ?`).join(", ")}${version} WHERE ${whereFields.map(k => `${k} = ?`).join(" AND ")}`).run(...fields.map(k => row[k]), ...whereFields.map(k => where[k]));
      if (!result.changes) return null;
      bumpStateVersion(tx);
      return this.get(where, tx);
    };
    return d ? work(d) : withTx(work);
  }
}

export function repo<K extends TableName>(table: K): Repository<K> { return new Repository(table); }
