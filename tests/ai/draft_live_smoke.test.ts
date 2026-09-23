import { afterAll, beforeAll, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db, resetInstance } from "../../src/db/client";
import { prepareSupplierEmail } from "../../src/ai/drafting";

let directory = "";
const prior = { DATABASE_PATH: process.env.DATABASE_PATH, ARTIFACT_PATH: process.env.ARTIFACT_PATH };
beforeAll(() => {
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

it("prepares an approved PO email through live OpenAI", async (ctx) => {
  if (process.env.AINALYM_LIVE_SMOKE !== "1") ctx.skip("UNVERIFIED: live provider not exercised (set AINALYM_LIVE_SMOKE=1)");
  if (!process.env.OPENAI_API_KEY) ctx.skip("UNVERIFIED: missing OpenAI credentials");
  const artifact = await prepareSupplierEmail("PO-LIVE-TEST");
  expect(artifact.state).toBe("needs_review");
  expect(artifact.markdown).toContain("SE-LIVE-TEST");
  expect(artifact.markdown).toContain("12 шт");
  console.log(`supplier_email provider=${artifact.provider} model=${artifact.model_version} consistency=${artifact.consistency}`);
}, 30_000);
