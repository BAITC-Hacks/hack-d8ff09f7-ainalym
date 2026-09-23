# ADJUST-1 closeout
Branch: `lane/adjust`, based on main; no UI, main, schema rename, secret, or force-push touched; no deviations.
Outcome: GET one recommendation and POST a versioned quantity adjustment now exist; list rows expose versions so the existing editor can save.
Evidence: One transaction persists `qty_adjusted` and `adjust_reason`, updates proposal line/totals and both versions, records one idempotent `recommendation_adjusted` action, and bumps state once.
Check: `npm run etl && npm run check` GREEN — passed=233 failed=0 skipped=12 externally-unverified=6; `npm run build` passed.
Edges: Tests cover stale 409/current_version (including version 0), invalid 400, unknown 404, zero quantity, existing database migration, ledger fallback, and proposal totals.
Files: `docs/CONTRACTS.md`; `src/app/api/recommendations/route.ts`, `src/app/api/recommendations/[id]/route.ts`, `src/app/api/recommendations/[id]/adjust/route.ts`; `src/db/client.ts`, `src/db/repo/index.ts`, `src/db/schema.sql`.
Files: `src/domain/apply.ts`; `src/server/contracts.ts`, `src/server/ledger.ts`, `src/server/recommendations.ts`; `tests/skeleton/adjust.test.ts`; `docs/agent_handoffs/ADJUST_1_CLOSEOUT.md`.
Tip: After deployment, fetch `/api/recommendations` and confirm each editable row has `version` before running the existing quantity-edit E2E journey.
Gate: GREEN — local ETL, full check, and production build passed; hosted browser journey remains unverified.
