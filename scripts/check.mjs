import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";

const allowed = new Set(["domain", "ai", "ui", "voice", "peers", "skeleton", "etl", "demo"]);
const filter = process.argv[2];
if (filter && !allowed.has(filter)) {
  console.error(`Unknown check filter: ${filter}`);
  process.exit(2);
}
const temp = mkdtempSync(join(tmpdir(), "ainalym-check-"));
const output = join(temp, "vitest.json");
const counts = { passed: 0, failed: 0, skipped: 0, externallyUnverified: 0 };
try {
  const args = ["vitest", "run", ...(filter ? [`tests/${filter}`] : []), "--reporter=json", `--outputFile=${output}`];
  const result = spawnSync("npx", args, { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, DATABASE_PATH: ":memory:" } });
  if (existsSync(output)) {
    const report = JSON.parse(readFileSync(output, "utf8"));
    for (const suite of report.testResults ?? []) {
      for (const test of suite.assertionResults ?? []) {
        const name = test.fullName || test.title;
        const note = test.note || test.invocations?.[0]?.note || "";
        if (test.status === "passed") { counts.passed++; console.log(`[PASS] ${name}`); }
        else if (test.status === "pending" || test.status === "skipped" || test.status === "todo") {
          counts.skipped++;
          if (String(note).startsWith("UNVERIFIED:") || test.title?.startsWith("UNVERIFIED:")) {
            counts.externallyUnverified++;
            console.log(`[UNVERIFIED] ${name} — ${note || test.title}`);
          } else console.log(`[SKIP] ${name}`);
        } else { counts.failed++; console.log(`[FAIL] ${name} — ${(test.failureMessages || []).join(" ")}`); }
      }
    }
  }
  if (result.error || result.status !== 0) {
    if (counts.failed === 0) counts.failed++;
    if (result.stderr) console.error(result.stderr.trim());
    if (!existsSync(output) && result.stdout) console.error(result.stdout.trim());
  }
  if (!filter && existsSync("scripts/scenario.mjs")) {
    const scenario = spawnSync("node", ["scripts/scenario.mjs"], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, DATABASE_PATH: ":memory:" } });
    for (const line of (scenario.stdout || "").split(/\r?\n/).filter(Boolean)) {
      console.log(line);
      if (/^\[PASS\]/.test(line)) counts.passed++;
      if (/^\[FAIL\]/.test(line)) counts.failed++;
      if (/^\[SKIP\]/.test(line)) counts.skipped++;
      if (/^\[UNVERIFIED\]/.test(line)) { counts.skipped++; counts.externallyUnverified++; }
    }
    if (scenario.error || scenario.status !== 0) {
      if (!/\[FAIL\]/.test(scenario.stdout || "")) counts.failed++;
      if (scenario.stderr) console.error(scenario.stderr.trim());
    }
  }
} finally { rmSync(temp, { recursive: true, force: true }); }
console.log(`check: passed=${counts.passed} failed=${counts.failed} skipped=${counts.skipped} externally-unverified=${counts.externallyUnverified}`);
if (counts.failed) process.exitCode = 1;
