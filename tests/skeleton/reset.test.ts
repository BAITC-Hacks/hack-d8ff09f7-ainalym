import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { db, dbPath, resetInstance } from "../../src/db/client";
import { processEvent } from "../../src/ai/worker";

describe("demo reset", () => {
  it("rebuilds partner tables and a runnable supplier reply with identical counts twice", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ainalym-reset-"));
    const path = join(dir, "partner.db");
    const run = () => {
      const result = spawnSync(process.execPath, ["scripts/demo_reset.mjs"], { cwd: process.cwd(), encoding: "utf8", timeout: 120000, env: { ...process.env, DATABASE_PATH: path } });
      expect(result.status, result.stderr).toBe(0);
      return JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1)!) as { counts: Record<string, number> };
    };
    try {
      const first = run();
      expect(first.counts.sku).toBeGreaterThan(3000);
      expect(first.counts.world_event).toBe(46);
      expect(first.counts.purchase_order).toBe(1);
      expect(first.counts.organization).toBe(1);
      expect(first.counts.recommendation).toBe(0);
      const prior = process.env.DATABASE_PATH;
      process.env.DATABASE_PATH = path;
      resetInstance();
      try {
        expect(dbPath()).toBe(path);
        expect(db().prepare("SELECT COUNT(*) AS n FROM sku").get()).toEqual({ n: first.counts.sku });
      } finally { resetInstance(); process.env.DATABASE_PATH = prior; }
      expect(run().counts).toEqual(first.counts);
      const priorProvider = process.env.AI_PROVIDER;
      const priorPath = process.env.DATABASE_PATH;
      process.env.DATABASE_PATH = path;
      process.env.AI_PROVIDER = "rules";
      resetInstance();
      try {
        db().prepare("UPDATE world_event SET state='pending' WHERE id='WE-046'").run();
        const result = await processEvent("WE-046");
        expect(result.reason).toBeUndefined();
        expect(db().prepare("SELECT state FROM world_event WHERE id='WE-046'").get()).toEqual({ state: "processed" });
        expect(db().prepare("SELECT COUNT(*) AS n FROM proposal WHERE kind='supplier_split'").get()).toEqual({ n: 1 });
      } finally {
        resetInstance();
        if (priorPath === undefined) delete process.env.DATABASE_PATH; else process.env.DATABASE_PATH = priorPath;
        if (priorProvider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = priorProvider;
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 240000);
});
