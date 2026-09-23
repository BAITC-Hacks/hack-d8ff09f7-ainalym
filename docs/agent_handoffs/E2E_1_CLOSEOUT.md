# E2E-1 closeout — lane/e2e
Outcome: Chromium judge-flow test, 1440×900 + 390×844 projects, screenshots, timing evidence and report.
Report: `docs/evidence/e2e/REPORT.md`; per-step evidence: `RESULTS.md` and project `steps.json`.
Defects: 3 confirmed — 2 P1 (disabled quantity save; intermittent blank hosted pages/502), 1 P3 (latency).
Check: `npx playwright test` → 2 failed (desktop 52.3 s; phone 1.4 min); failures continue to later steps.
PASS: access, assistant truth labels, sampled keyboard focus; desktop world qty 198 → 98; phone width/targets.
Unverified: quantity receipt/version/ledger; proposal approval, PO state and downloaded Код 1с export.
Qualification: Pulse zero states are textual; strict numeric acceptance fails without proving wrong arithmetic.
SKU follow-up: phone row → chart/facts/provenance PASS; desktop had empty recommendations.
Final SKU-wait/queue-match refinements passed static checks; no subsequent full mutation run.
Static checks: TypeScript, scoped ESLint, test discovery and git diff --check PASS.
Files: `.gitignore`, `package.json`, `package-lock.json`, root Playwright config, `tests/e2e/*`, evidence, this closeout.
Exact file inventory: `docs/evidence/e2e/FILES.txt`.
Safety: code only filled into auth form; inputs masked; no auth/trace/video/HAR artifacts or downloaded business data.
Budget: fewer than 60 AI-triggering UI actions; conservative accounting and limits in RUN_NOTES.md.
Protected: no app source, main, external supplier delivery, force-push, deployment or reset.
State: hosted revision/data changed during testing; early 404/503 findings are historical, not pinned-current claims.
Tip: stabilize hosting and recommendation versions, then `npm run e2e` with both env vars set; finish approval/export.
Gate: RED — test/evidence delivered; hosted must-have purchase cycle remains blocked.
