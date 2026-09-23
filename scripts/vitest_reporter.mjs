import { writeFileSync } from "node:fs";

export default class CheckReporter {
  cases = [];

  onTestCaseResult(test) {
    const result = test.result();
    this.cases.push({ name: test.fullName, status: result.state, note: result.state === "skipped" ? result.note : undefined,
      errors: result.state === "failed" ? result.errors.map(error => error.message || String(error)) : [] });
  }

  onTestRunEnd(modules, errors) {
    const collected = [];
    for (const module of modules) {
      for (const suite of [module, ...module.children.allSuites()]) {
        for (const error of suite.errors()) collected.push(`${suite.fullName || module.relativeModuleId}: ${error.message || String(error)}`);
      }
    }
    if (process.env.AINALYM_CHECK_REPORT) {
      writeFileSync(process.env.AINALYM_CHECK_REPORT, JSON.stringify({ cases: this.cases, errors: [...collected, ...errors.map(error => error.message || String(error))] }));
    }
  }
}
