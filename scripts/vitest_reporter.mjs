import { writeFileSync } from "node:fs";

export default class CheckReporter {
  cases = [];

  onTestCaseResult(test) {
    const result = test.result();
    this.cases.push({ name: test.fullName, status: result.state, note: result.state === "skipped" ? result.note : undefined,
      errors: result.state === "failed" ? result.errors.map(error => error.message || String(error)) : [] });
  }

  onTestRunEnd(_modules, errors) {
    if (process.env.AINALYM_CHECK_REPORT) {
      writeFileSync(process.env.AINALYM_CHECK_REPORT, JSON.stringify({ cases: this.cases, errors: errors.map(error => error.message || String(error)) }));
    }
  }
}
