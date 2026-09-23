import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

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
      expect(run().counts).toEqual(first.counts);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 240000);
});
