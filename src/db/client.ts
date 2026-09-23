// Root seam (T+8). L1 extends additively; every lane may use db()/withTx directly for its own tables.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

let instance: DatabaseSync | null = null;

export function dbPath(): string {
  return process.env.DATABASE_PATH || join(process.cwd(), "data", "partner.db");
}

export function db(): DatabaseSync {
  if (instance) return instance;
  const path = dbPath();
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  instance = new DatabaseSync(path);
  migrate(instance);
  return instance;
}

export function migrate(d: DatabaseSync = db()): void {
  const sql = readFileSync(join(process.cwd(), "src", "db", "schema.sql"), "utf8");
  d.exec(sql);
  const columns = new Set((d.prepare("PRAGMA table_info(sku)").all() as { name: string }[]).map((row) => row.name));
  for (const name of ["on_hand_qty", "on_hand_as_of"]) if (!columns.has(name)) d.exec(`ALTER TABLE sku ADD COLUMN ${name} TEXT`);
  const eventColumns = new Set((d.prepare("PRAGMA table_info(world_event)").all() as { name: string }[]).map(row => row.name));
  for (const [name, ddl] of [
    ["claimed_at", "TEXT"], ["attempt", "INTEGER NOT NULL DEFAULT 0"],
    ["processing_stage", "TEXT NOT NULL DEFAULT 'unclaimed'"], ["affected_codes", "TEXT NOT NULL DEFAULT '[]'"],
  ]) if (!eventColumns.has(name)) d.exec(`ALTER TABLE world_event ADD COLUMN ${name} ${ddl}`);
}

export function withTx<T>(fn: (d: DatabaseSync) => T): T {
  const d = db();
  d.exec("BEGIN");
  try {
    const out = fn(d);
    d.exec("COMMIT");
    return out;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

export function bumpStateVersion(d: DatabaseSync = db()): number {
  d.exec("UPDATE state_version SET n = n + 1");
  const row = d.prepare("SELECT n FROM state_version").get() as { n: number };
  return row.n;
}

export function stateVersion(d: DatabaseSync = db()): number {
  const row = d.prepare("SELECT n FROM state_version").get() as { n: number } | undefined;
  return row?.n ?? 0;
}

export function resetInstance(): void {
  instance?.close();
  instance = null;
}
