import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db, resetInstance } from "../../src/db/client";
import { processEvent } from "../../src/ai/worker";

const directory = mkdtempSync(join(tmpdir(), "ainalym-partner-event-"));
const prior = process.env.DATABASE_PATH;

beforeAll(() => {
  const path = join(directory, "partner.db");
  const loaded = spawnSync(process.execPath, ["scripts/etl/load.mjs", "--db", path], {
    cwd: process.cwd(), encoding: "utf8", timeout: 30_000,
  });
  if (loaded.status !== 0) throw new Error(`partner ETL failed: ${loaded.stderr}`);
  resetInstance();
  process.env.DATABASE_PATH = path;
  const event = readFileSync("fixtures/world_events.jsonl", "utf8").split("\n")
    .filter(Boolean).map(line => JSON.parse(line) as Record<string, unknown>).find(row => row.id === "WE-043");
  if (!event) throw new Error("WE-043 fixture missing");
  db().prepare(`INSERT INTO world_event(id,org_id,seq,kind,code_1c,source_id,at,text,payload,state)
    VALUES (?,?,?,?,?,?,?,?,?,'pending')`).run(String(event.id), String(event.org_id), Number(event.seq), String(event.kind),
      event.code_1c == null ? null : String(event.code_1c), String(event.source_id), String(event.at),
      event.text == null ? null : String(event.text), JSON.stringify(event.payload));
}, 35_000);
afterAll(() => {
  resetInstance();
  if (prior === undefined) delete process.env.DATABASE_PATH; else process.env.DATABASE_PATH = prior;
  rmSync(directory, { recursive: true, force: true });
});

describe("partner event replay", () => {
  it("excludes the injected one-off and prepares a supplier proposal", async () => {
    const result = await processEvent("WE-043");
    expect(result.reason).toBeUndefined();
    expect((db().prepare("SELECT state FROM world_event WHERE id='WE-043'").get() as { state: string }).state).toBe("processed");
    const row = db().prepare("SELECT components FROM recommendation WHERE code_1c='010500008_' ORDER BY rowid DESC LIMIT 1")
      .get() as { components: string } | undefined;
    expect(row).toBeTruthy();
    expect((db().prepare("SELECT COUNT(*) AS n FROM proposal WHERE kind='supplier_order' AND state='needs_review'").get() as { n: number }).n).toBeGreaterThan(0);
    const components = JSON.parse(row!.components) as { outliers_excluded?: { doc_no: string }[]; outlier_threshold?: number };
    expect(components.outliers_excluded?.some(doc => doc.doc_no === "JUDGE-ONEOFF-5000"),
      `outlier_threshold=${components.outlier_threshold}; excluded=${components.outliers_excluded?.length || 0}`).toBe(true);
  }, 35_000);
});
