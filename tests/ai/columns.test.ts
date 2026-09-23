import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db, resetInstance } from "../../src/db/client";
import { buildSemanticColumn } from "../../src/ai/columns";
import { POST } from "../../src/app/api/columns/route";

const directory = mkdtempSync(join(tmpdir(), "ainalym-ai-columns-"));
const prior = {
  DATABASE_PATH: process.env.DATABASE_PATH,
  AINALYM_MODE: process.env.AINALYM_MODE,
  AI_PROVIDER: process.env.AI_PROVIDER,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};

beforeAll(() => {
  process.env.DATABASE_PATH = join(directory, "test.db");
  process.env.AINALYM_MODE = "live";
  process.env.AI_PROVIDER = "rules";
  resetInstance();
  const d = db();
  d.prepare("INSERT INTO organization(id,name) VALUES ('OWN','Test')").run();
  d.prepare("INSERT INTO supplier(id,name,lead_time_days,terms) VALUES ('IEK','IEK',40,?)")
    .run(JSON.stringify({ text: "Предоплата 50%" }));
  d.prepare("INSERT INTO supplier(id,name,lead_time_days) VALUES ('SE','SE',50)").run();
  d.prepare("INSERT INTO sku(code_1c,supplier_id,name) VALUES ('AI-CABLE','IEK','Кабель силовой')").run();
  d.prepare("INSERT INTO sku(code_1c,supplier_id,name,category) VALUES ('SE-SOCKET','SE','Розетка','electrical')").run();
  d.prepare("INSERT INTO recommendation(id,run_id,code_1c,supplier_id,qty_recommended,urgency) VALUES ('REC-1','RUN-1','AI-CABLE','IEK',12,'soon')").run();
});

afterAll(() => {
  resetInstance();
  for (const [key, value] of Object.entries(prior)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  rmSync(directory, { recursive: true, force: true });
});

describe("replenishment semantic columns", () => {
  it("judges a missing IEK category and cites the decision without editing the SKU", async () => {
    const column = await buildSemanticColumn("Категория", ["AI-CABLE", "SE-SOCKET"]);
    expect(column).toMatchObject({ intent: "category", result_state: "ready" });
    expect(column.rows[0]).toMatchObject({ value: "cables", provider: "rules", model_version: "rules-v1", result_state: "decided" });
    expect(column.rows[0].sources).toEqual(["sku:AI-CABLE", column.rows[0].decision_record_id]);
    expect(column.rows[1]).toMatchObject({ value: "electrical", provider: "source" });
    expect((db().prepare("SELECT category FROM sku WHERE code_1c='AI-CABLE'").get() as { category: string | null }).category).toBeNull();
  });

  it("uses a source-backed supplier term and engine urgency", async () => {
    expect((await buildSemanticColumn("Условия оплаты", ["AI-CABLE"])).rows[0])
      .toMatchObject({ value: "prepayment", provider: "rules", result_state: "decided" });
    expect((await buildSemanticColumn("Срочность", ["AI-CABLE"])).rows[0])
      .toMatchObject({ value: "soon", provider: "engine", sources: ["REC-1"] });
  });

  it("returns missing_inputs for unsupported headers and missing source facts", async () => {
    const unsupported = await buildSemanticColumn("Маржа клиента", ["AI-CABLE"]);
    expect(unsupported).toMatchObject({ intent: "unsupported", result_state: "missing_inputs" });
    expect(unsupported.rows[0]).toMatchObject({ value: null, result_state: "missing_inputs" });
    const missing = await buildSemanticColumn("Условия оплаты", ["SE-SOCKET", "UNKNOWN"]);
    expect(missing.result_state).toBe("missing_inputs");
    expect(missing.rows.every(row => row.value === null)).toBe(true);
  });

  it("returns 503 when the selected model is unavailable", async () => {
    process.env.AI_PROVIDER = "openai";
    delete process.env.OPENAI_API_KEY;
    try {
      const response = await POST(new Request("http://localhost/api/columns", {
        method: "POST", body: JSON.stringify({ header: "Категория", code_1c: ["AI-CABLE"] }),
      }));
      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.column.rows[0]).toMatchObject({ value: null, result_state: "provider_error" });
    } finally {
      process.env.AI_PROVIDER = "rules";
    }
  });
});
