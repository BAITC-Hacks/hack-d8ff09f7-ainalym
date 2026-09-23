import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { read as readXlsx, utils as xlsxUtils } from "xlsx";
import { db, resetInstance } from "../../src/db/client";
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
    const files = exportOrder("PO-1");
    const csvRow = readFileSync(files.csv_path, "utf8").trim().split(/\r?\n/)[1].split(";");
    expect(csvRow[5]).toBe(label);
    const workbook = readXlsx(readFileSync(files.xlsx_path), { type: "buffer" });
    const rows = xlsxUtils.sheet_to_json<(string | number)[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    expect(rows[1][5]).toBe(label);
  });
});
