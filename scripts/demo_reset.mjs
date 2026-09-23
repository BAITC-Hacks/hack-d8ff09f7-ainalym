import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import Decimal from "decimal.js";
import { databasePath } from "../src/db/path.mjs";

const root = process.cwd();
const loader = join(root, "scripts", "etl", "load.mjs");
if (!existsSync(loader)) {
  console.error("ETL unavailable: scripts/etl/load.mjs has not landed");
  process.exit(2);
}
const targetPath = databasePath();
if (process.env.DATABASE_PATH === ":memory:") {
  console.error("demo:reset requires a database file path");
  process.exit(2);
}
for (const suffix of ["", "-wal", "-shm"]) {
  const path = targetPath + suffix;
  if (existsSync(path)) unlinkSync(path);
}
const etl = spawnSync(process.execPath, [loader, "--db", targetPath], {
  cwd: root, encoding: "utf8", env: { ...process.env, DATABASE_PATH: targetPath },
});
if (etl.status !== 0 || etl.error) {
  console.error((etl.stderr || etl.error?.message || "ETL failed").trim());
  process.exit(etl.status || 1);
}
const d = new DatabaseSync(targetPath);
if (!d.prepare("SELECT id FROM organization WHERE id = 'partner'").get()) {
  d.prepare("INSERT INTO organization (id,name,payload) VALUES (?,?,?)").run("partner", "Электрокомплект · обезличено", JSON.stringify({ opening_cash: [] }));
}
// A local, approved order gives the scripted supplier reply an exact subject.
// This is a demo commitment only; no supplier channel or external send is created.
const demoPo = "PO-DEMO-SUPPLIER-REPLY";
if (!d.prepare("SELECT id FROM purchase_order WHERE id=?").get(demoPo)) {
  const item = d.prepare("SELECT unit_cost FROM sku WHERE code_1c='130300027_' AND supplier_id='SE'").get();
  if (!item?.unit_cost) throw new Error("Demo supplier item cost missing");
  const total = new Decimal(item.unit_cost).times(100).toFixed(2);
  const prepayment = new Decimal(total).times(0.3).toFixed(2);
  const balance = new Decimal(total).minus(prepayment).toFixed(2);
  d.exec("BEGIN");
  try {
    d.prepare("INSERT INTO purchase_order(id,supplier_id,state,total_qty,total_cost,cost_known_lines,eta) VALUES (?,'SE','approved',100,?,1,'2026-10-01T00:00:00Z')").run(demoPo,total);
    d.prepare("INSERT INTO purchase_order_line(po_id,code_1c,qty,unit_cost,rationale_ru) VALUES (?,'130300027_',100,?,'Демонстрационный заказ для ответа поставщика')").run(demoPo,item.unit_cost);
    d.prepare("INSERT INTO obligation(id,kind,po_id,supplier_id,amount,due_at,basis) VALUES (?,'supplier_prepayment',?,'SE',?,'2026-09-23T09:00:00Z',?)")
      .run(`${demoPo}:supplier_prepayment`,demoPo,prepayment,demoPo);
    d.prepare("INSERT INTO obligation(id,kind,po_id,supplier_id,amount,due_at,basis) VALUES (?,'supplier_balance',?,'SE',?,'2026-10-01T00:00:00Z',?)")
      .run(`${demoPo}:supplier_balance`,demoPo,balance,demoPo);
    d.exec("COMMIT");
  } catch (error) { d.exec("ROLLBACK"); throw error; }
}
const worldPath = join(root, "fixtures", "world_events.jsonl");
if (existsSync(worldPath)) {
  const lines = readFileSync(worldPath, "utf8").split(/\r?\n/).filter(Boolean);
  const org = d.prepare("SELECT id FROM organization LIMIT 1").get()?.id || "DEMO-PARTNER-A";
  d.exec("BEGIN");
  try {
    const insert = d.prepare(`INSERT OR IGNORE INTO world_event
      (id,org_id,seq,kind,actor_id,code_1c,po_id,at,source_id,text,payload,state)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,'scripted')`);
    lines.forEach((line, index) => {
      const event = JSON.parse(line);
      insert.run(event.id || `WE-SCRIPT-${index + 1}`, event.org_id || org,
        event.seq ?? index + 1, event.kind, event.actor_id || null, event.code_1c || null,
        event.po_id || null, event.at || null, event.source_id || `SCRIPT-${index + 1}`,
        event.text || null, JSON.stringify(event.payload || {}));
    });
    d.exec("COMMIT");
  } catch (error) { d.exec("ROLLBACK"); throw error; }
}
const names = d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name);
const counts = Object.fromEntries(names.map(name => [name, d.prepare(`SELECT COUNT(*) AS n FROM ${name}`).get().n]));
d.close();
for (const [name, count] of Object.entries(counts)) console.log(`${name}=${count}`);
console.log(JSON.stringify({ ok: true, counts }));
