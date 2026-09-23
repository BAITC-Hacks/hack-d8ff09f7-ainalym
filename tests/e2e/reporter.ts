import type { Reporter, FullResult } from '@playwright/test/reporter';
import fs from 'node:fs';
export default class EvidenceReporter implements Reporter {
  onEnd(result: FullResult) {
    const rows: string[] = [];
    for (const project of ['desktop', 'phone']) {
      const file = `docs/evidence/e2e/${project}/steps.json`;
      if (!fs.existsSync(file)) continue;
      for (const step of JSON.parse(fs.readFileSync(file, 'utf8'))) {
        rows.push(`| ${project} | ${step.step} | ${step.status} | [screenshot](${project}/${step.step.split(' ')[0]}.jpg) | ${step.detail.replace(/\|/g, '/')} |`);
      }
    }
    fs.writeFileSync('docs/evidence/e2e/RESULTS.md', `# Hosted judge steps — ${new Date().toISOString()}\n\nRunner: ${result.status}. Step durations include assertions and screenshot capture; page/API timings are in each project's measurements.json.\n\n| Project | Step | Result | Evidence | Duration and observation |\n|---|---|---|---|---|\n${rows.join('\n')}\n`);
  }
}
