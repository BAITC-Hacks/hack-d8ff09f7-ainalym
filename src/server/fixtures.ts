import { spawnSync } from "node:child_process";
import { dbPath, resetInstance } from "@/db/client";

export function resetDemo(): { counts: Record<string, number> } {
  resetInstance();
  const run = spawnSync(process.execPath, ["scripts/demo_reset.mjs"], {
    cwd: process.cwd(), encoding: "utf8", env: { ...process.env, DATABASE_PATH: dbPath() },
  });
  if (run.status !== 0 || run.error) throw new Error((run.stderr || run.error?.message || "ETL failed").trim());
  const last = run.stdout.trim().split(/\r?\n/).at(-1);
  const result = JSON.parse(last || "null") as { counts: Record<string, number> };
  if (!result?.counts) throw new Error("ETL produced no counts");
  return result;
}
