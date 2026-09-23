import { afterAll, beforeAll, expect, it } from "vitest";
import { loadEnvConfig } from "@next/env";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db, resetInstance } from "../../src/db/client";
import { prepareSupplierEmail } from "../../src/ai/drafting";

let directory = "";
const prior = { DATABASE_PATH: process.env.DATABASE_PATH, ARTIFACT_PATH: process.env.ARTIFACT_PATH };
beforeAll(() => {
  const env = process.env as Record<string, string | undefined>;
  const mode = env.NODE_ENV;
  env.NODE_ENV = "development";
  loadEnvConfig(process.cwd(), true, undefined, true);
  if (mode === undefined) delete env.NODE_ENV; else env.NODE_ENV = mode;
  resetInstance();
  directory = mkdtempSync(join(tmpdir(), "ainalym-draft-live-"));
  process.env.DATABASE_PATH = join(directory, "draft.db");
  process.env.ARTIFACT_PATH = join(directory, "artifacts");
  db().prepare("INSERT INTO supplier(id,name,lead_time_days) VALUES ('SE','System Electric',50)").run();
  db().prepare("INSERT INTO sku(code_1c,supplier_id,name) VALUES ('SE-LIVE-TEST','SE','Выключатель')").run();
  db().prepare("INSERT INTO purchase_order(id,supplier_id,state,total_qty) VALUES ('PO-LIVE-TEST','SE','approved',12)").run();
  db().prepare("INSERT INTO purchase_order_line(po_id,code_1c,qty) VALUES ('PO-LIVE-TEST','SE-LIVE-TEST',12)").run();
});
afterAll(() => {
  resetInstance();
  for (const [key, value] of Object.entries(prior)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  if (directory) rmSync(directory, { recursive: true, force: true });
});

it.skipIf(process.env.RUN_AI_DRAFT_LIVE !== "1")("prepares an approved PO email through live OpenAI", async () => {
  if (!process.env.OPENAI_API_KEY) { console.log("draft: externally-unverified (missing key)"); return; }
  const artifact = await prepareSupplierEmail("PO-LIVE-TEST");
  expect(artifact.state).toBe("needs_review");
  expect(artifact.markdown).toContain("SE-LIVE-TEST");
  expect(artifact.markdown).toContain("12 шт");
  console.log(`supplier_email provider=${artifact.provider} model=${artifact.model_version} consistency=${artifact.consistency}`);
}, 30_000);
