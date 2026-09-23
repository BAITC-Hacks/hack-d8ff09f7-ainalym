import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { db, dbPath, resetInstance } from "../../src/db/client";

describe("demo reset", () => {
  it("rebuilds partner tables and scripted inbox with identical counts twice", () => {
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
      expect(first.counts.world_event).toBe(45);
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
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 240000);
});
