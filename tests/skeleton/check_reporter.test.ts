import { afterEach, expect, it } from "vitest";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import CheckReporter from "../../scripts/vitest_reporter.mjs";

const priorReport = process.env.AINALYM_CHECK_REPORT;
afterEach(() => { process.env.AINALYM_CHECK_REPORT = priorReport; });

it("serializes collection errors from modules and suites", () => {
  const dir = mkdtempSync(join(tmpdir(), "ainalym-reporter-"));
  try {
    const path = join(dir, "report.json");
    process.env.AINALYM_CHECK_REPORT = path;
    new CheckReporter().onTestRunEnd([{
      relativeModuleId: "broken.test.ts", errors: () => [{ message: "import failed" }],
      children: { allSuites: () => [{ fullName: "nested", errors: () => [{ message: "suite failed" }] }] },
    }], []);
    expect(JSON.parse(readFileSync(path, "utf8")).errors).toEqual(["broken.test.ts: import failed", "nested: suite failed"]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it.each(["missing", "invalid"])("fails closed when the child exits zero with a %s report", kind => {
  const dir = mkdtempSync(join(tmpdir(), "ainalym-check-"));
  try {
    const runner = join(dir, "npx");
    writeFileSync(runner, `#!/bin/sh\n${kind === "invalid" ? 'printf "bad json" > "$AINALYM_CHECK_REPORT"' : "true"}\nexit 0\n`);
    chmodSync(runner, 0o755);
    const result = spawnSync(process.execPath, ["scripts/check.mjs", "skeleton"], { cwd: process.cwd(), encoding: "utf8",
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}` } });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("[FAIL] vitest report");
    expect(result.stdout).toMatch(/check: passed=0 failed=[1-9]/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
