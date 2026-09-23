import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { db, resetInstance } from "../../src/db/client";
import { executeVoiceTool } from "../../src/voice/tools";

describe("partner-data voice integration", () => {
  it("runs a scoped calculation on an anonymised partner SKU", async () => {
    const directory = mkdtempSync(join(tmpdir(), "ainalym-voice-partner-"));
    const path = join(directory, "partner.db");
    const priorPath = process.env.DATABASE_PATH;
    try {
      const etl = spawnSync(process.execPath, ["scripts/etl/load.mjs", "--db", path], { cwd: process.cwd(), encoding: "utf8" });
      expect(etl.status).toBe(0);
      resetInstance();
      process.env.DATABASE_PATH = path;
      const d = db();
      // The current ETL omits the contract organization row; isolate that upstream gap.
      d.prepare("INSERT INTO organization (id, name) VALUES (?, ?)").run("ORG-1", "Partner demo");
      const candidate = d.prepare(`SELECT s.code_1c FROM sku s WHERE s.supplier_id = ?
        AND (SELECT COUNT(*) FROM sales_month m WHERE m.code_1c = s.code_1c AND m.qty_file IS NOT NULL) >= 12
        AND (SELECT known FROM stock_month t WHERE t.code_1c = s.code_1c ORDER BY ym DESC LIMIT 1) = 1
        ORDER BY s.months_with_sales DESC, s.code_1c LIMIT 1`).get("SE") as { code_1c: string } | undefined;
      expect(candidate).toBeDefined();
      const response = await executeVoiceTool("recommend_for", {
        request_id: "partner-voice-run", scope: { org_id: "ORG-1", supplier_id: "SE", code_1c: candidate!.code_1c }, args: { supplier_id: "SE" },
      });
      expect(response.status).toBe(200);
      expect(response.result.run_id).toMatch(/^RUN-/);
      expect(d.prepare("SELECT COUNT(*) AS n FROM calc_run").get()).toEqual({ n: 1 });
    } finally {
      resetInstance();
      if (priorPath === undefined) delete process.env.DATABASE_PATH; else process.env.DATABASE_PATH = priorPath;
      rmSync(directory, { recursive: true, force: true });
    }
  }, 30_000);
});
