import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { read as readXlsx, utils as xlsxUtils } from "xlsx";
import { db, migrate, resetInstance } from "../../src/db/client";
import { applyRecommendations, decideProposal } from "../../src/domain/apply";
import { applyWorldEvent } from "../../src/domain/events";
import { approveOrder } from "../../src/domain/orders";
import { recomputeAffected } from "../../src/domain/recompute";
import { deliverOrder } from "../../src/peers/deliver";
import { exportOrder } from "../../src/peers/onec_export";

let exportDir: string;
beforeEach(() => {
  exportDir = mkdtempSync(join(tmpdir(), "ainalym-export-"));
  process.env.EXPORT_DIR = exportDir;
  process.env.DATABASE_PATH = ":memory:";
  resetInstance();
  const d = db();
  d.prepare("INSERT INTO organization (id,name) VALUES (?,?)").run("ORG-TEST", "Test");
  d.prepare("INSERT INTO supplier (id,name,lead_time_days) VALUES (?,?,?)").run("IEK", "IEK", 40);
  d.prepare("INSERT INTO sku (code_1c,supplier_id,name,article,moq) VALUES (?,?,?,?,?)").run("03001_", "IEK", "Кабель", "K-5", 5);
  d.prepare("INSERT INTO purchase_order (id,supplier_id,state,total_qty) VALUES (?,?,?,?)").run("PO-1", "IEK", "approved", 20);
  d.prepare("INSERT INTO purchase_order_line (po_id,code_1c,qty,rationale_ru) VALUES (?,?,?,?)").run("PO-1", "03001_", 20, "Потребность на 70 дней");
});
afterEach(() => { resetInstance(); rmSync(exportDir, { recursive: true, force: true }); delete process.env.EXPORT_DIR; });

describe("1C file export boundary", () => {
  it("adds recommendation_id to an existing order line table", () => {
    const legacy = new DatabaseSync(":memory:");
    try {
      legacy.exec("CREATE TABLE purchase_order_line (id INTEGER PRIMARY KEY, po_id TEXT, code_1c TEXT, qty INTEGER, unit_cost TEXT, rationale_ru TEXT)");
      migrate(legacy);
      expect((legacy.prepare("PRAGMA table_info(purchase_order_line)").all() as { name: string }[]).map(row => row.name)).toContain("recommendation_id");
    } finally { legacy.close(); }
  });

  it("writes CSV and XLSX for an approved PO, then replays one peer record", async () => {
    const first = exportOrder("PO-1");
    const second = exportOrder("PO-1");
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(first.external).toBe("export_only");
    expect(first).toMatchObject({ provenance: "partner_anonymised", ai: "none", external: "export_only" });
    expect(second).toMatchObject({ provenance: "partner_anonymised", ai: "none", external: "export_only" });
    expect(first.label).toBe("Экспорт для 1С (файл)");
    expect(readFileSync(first.csv_path, "utf8")).toContain("Код 1с;Артикул поставщика;Наименование;Кол-во;Кратность;Срочность;Обоснование");
    expect(readFileSync(first.csv_path, "utf8")).toContain("03001_");
    expect(readFileSync(first.xlsx_path).subarray(0, 2).toString()).toBe("PK");
    expect(db().prepare("SELECT COUNT(*) AS n FROM ledger_peer_record WHERE peer = 'onec_export'").get()).toMatchObject({ n: 1 });
    expect(db().prepare("SELECT state FROM purchase_order WHERE id = 'PO-1'").get()).toMatchObject({ state: "exported" });
    expect(await deliverOrder({ id: "PO-1" })).toMatchObject({ state: "exported", path: first.xlsx_path });
  });

  it("refuses export before human approval", async () => {
    db().prepare("UPDATE purchase_order SET state = 'draft' WHERE id = 'PO-1'").run();
    expect(() => exportOrder("PO-1")).toThrow("po_not_approved");
    expect(await deliverOrder({ id: "PO-1" })).toMatchObject({ state: "delivery_failed", reason: "po_not_approved" });
  });

  it.each([["critical", "критично"], ["soon", "скоро"], ["normal", "планово"], ["none", "не требуется"]])("writes %s urgency as the canonical Russian label", (urgency, label) => {
    db().prepare("INSERT INTO calc_run(id,scope,params,started_at) VALUES ('RUN-1','{}','{}','2026-09-23')").run();
    db().prepare("UPDATE purchase_order SET run_id='RUN-1' WHERE id='PO-1'").run();
    db().prepare("INSERT INTO recommendation(id,run_id,code_1c,supplier_id,qty_recommended,urgency) VALUES (?,?,?,?,?,?)")
      .run("REC-1", "RUN-1", "03001_", "IEK", 20, urgency);
    db().prepare("UPDATE purchase_order_line SET recommendation_id='REC-1' WHERE po_id='PO-1'").run();
    const files = exportOrder("PO-1");
    const csvRow = readFileSync(files.csv_path, "utf8").trim().split(/\r?\n/)[1].split(";");
    expect(csvRow[5]).toBe(label);
    const workbook = readXlsx(readFileSync(files.xlsx_path), { type: "buffer" });
    const rows = xlsxUtils.sheet_to_json<(string | number)[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    expect(rows[1][5]).toBe(label);
  });

  it("keeps all 294 SE line urgencies after a one-SKU world recompute", async () => {
    const d = db();
    d.prepare("INSERT INTO supplier (id,name,lead_time_days) VALUES ('SE','System Electric',50)").run();
    d.prepare("INSERT INTO calc_run (id,scope,params,started_at) VALUES ('RUN-SE','{\"supplier\":\"SE\"}','{}','2026-09-23')").run();
    const insertSku = d.prepare("INSERT INTO sku (code_1c,supplier_id,name,moq,on_hand_qty,on_hand_as_of) VALUES (?,'SE',?,1,'0',?)");
    const insertRec = d.prepare("INSERT INTO recommendation (id,run_id,code_1c,supplier_id,qty_recommended,urgency,rationale_ru) VALUES (?,'RUN-SE',?,'SE',10,?,?)");
    const today = new Date().toISOString().slice(0, 10);
    const expected = new Map<string, [string, string]>();
    for (let index = 0; index < 294; index++) {
      const code = `SE-${String(index).padStart(3, "0")}`;
      const urgency = ["critical", "soon", "normal"][index % 3];
      const rationale = `Основание ${code}`;
      insertSku.run(code, code, today);
      insertRec.run(`REC-SE-${index}`, code, urgency, rationale);
      expected.set(code, [{ critical: "критично", soon: "скоро", normal: "планово" }[urgency]!, rationale]);
    }
    const proposal = (await applyRecommendations("RUN-SE")).proposals[0];
    expect((JSON.parse(proposal.payload as string) as { lines: unknown[] }).lines).toHaveLength(294);
    const decided = await decideProposal(String(proposal.id), Number(proposal.version), "approve");
    const poId = decided.po_id!;
    expect((d.prepare("SELECT COUNT(*) AS n FROM purchase_order_line WHERE po_id=? AND recommendation_id IS NOT NULL").get(poId) as { n: number }).n).toBe(294);
    approveOrder(poId, 1);

    const affectedCode = "SE-000";
    for (let index = 0; index < 12; index++) {
      const date = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 - index, 1));
      const ym = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      d.prepare("INSERT INTO sales_month (code_1c,ym,qty_file) VALUES (?,?, '30')").run(affectedCode, ym);
    }
    d.prepare("INSERT INTO stock_month (code_1c,ym,opening_qty) VALUES (?,?,'0')").run(affectedCode, today.slice(0, 7));
    await applyWorldEvent({ id: "WE-SE-TRANSIT", kind: "in_transit_update", code_1c: affectedCode, payload: { po_ref: "SUP-SE", delta: 100 } });
    const recomputed = await recomputeAffected([affectedCode]);
    expect(recomputed.recommendation_ids).toHaveLength(1);
    d.prepare("UPDATE purchase_order SET run_id=? WHERE id=?").run(recomputed.run_id, poId);

    const files = exportOrder(poId);
    const lines = readFileSync(files.csv_path, "utf8").replace(/^\ufeff/, "").trim().split(/\r?\n/).slice(1);
    expect(lines).toHaveLength(294);
    for (const line of lines) {
      const [code, , , , , urgency, rationale] = line.split(";");
      expect([urgency, rationale]).toEqual(expected.get(code));
    }
    expect(new Set(lines.map(line => line.split(";")[5]))).toEqual(new Set(["критично", "скоро", "планово"]));
  }, 30000);
});
