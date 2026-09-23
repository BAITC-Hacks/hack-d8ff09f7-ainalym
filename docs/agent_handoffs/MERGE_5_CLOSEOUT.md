# MERGE-5 closeout
Merged `lane/today_perf` (`faa8dce`) into `lane/merge5` with `--no-ff`.
Conflicts: `src/app/api/recommendations/route.ts` and `src/db/schema.sql`.
Route: retained batched outlier/stockout reads plus adjustment state/version/reason/proposal, registry image, and all EKT fields.
Schema: retained `org_id` and performance indexes plus `adjust_reason`, `recommendation_id`, and existing additive migrations.
Checks: `npm install`, `npm run etl`, `npm run check` (251 passed, 0 failed, 7 externally unverified), and `npm run build` passed.
Four-run lane test: 1,259 recommendation rows per run; `/api/today` 9.259 ms, `/api/queue` 0.278 ms; test passed.
Build emitted nonblocking middleware and filesystem tracing warnings.
Gate: GREEN.
