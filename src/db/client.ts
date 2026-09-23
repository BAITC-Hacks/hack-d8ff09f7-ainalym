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
