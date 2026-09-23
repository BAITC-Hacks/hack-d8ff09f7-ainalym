# L1-FIX-1 closeout — lane/l1_fix

- Ledger `0bb976c`: synchronous API and transaction guard; `src/server/ledger.ts`, `src/db/client.ts`, `tests/skeleton/repository_ledger.test.ts` prove rollback after injected failure.
- DB path `f85698a`: shared resolver for app/reset/ETL/derive/deploy; `src/db/path.mjs`, `src/db/client.ts`, `scripts/demo_reset.mjs`, `scripts/etl/load.mjs`, `scripts/etl/derive.mjs`, `scripts/deploy/first_etl.sh`, `tests/skeleton/reset.test.ts`.
- Calc `a545cc3`: 503 on missing org/source rows before persistence; `src/server/calc.ts`, `src/server/http.ts`, `tests/skeleton/calc_availability.test.ts`.
- Health `6fc58e3`: middleware passes health through; `src/middleware.ts`, `tests/skeleton/smoke.test.ts` verify contracted fields and SQLite failure.
- Today `ecb9543`: commitments come from proposals, with `pending_reason`; `src/app/api/today/route.ts`, `src/server/contracts.ts`, `tests/skeleton/pipeline.test.ts`.
- Obligations `91241b5`: one state bump per approval transaction; `src/domain/obligations.ts`, `tests/skeleton/obligations_version.test.ts`.
- Check `4b7d962`: suite/import and missing/invalid reports fail closed; `scripts/vitest_reporter.mjs`, `scripts/check.mjs`, `tests/skeleton/check_reporter.test.ts`.
- Provider `ef5af70`: truth labels share provider selection; `src/server/http.ts`, `src/app/api/health/route.ts`, `tests/skeleton/provider_truth.test.ts`.
- Deployment follow-up `d74c832`: retained explicit `--db` in `scripts/deploy/first_etl.sh` after the existing production contract caught it.
- Checks: `npm run etl && npm run check` GREEN — `check: passed=207 failed=0 skipped=9 externally-unverified=0`; `npm run build` passed.
- Limits: Next warns that dynamic DB path resolution broadens file tracing; middleware convention is deprecated. `ops/reviews/skeleton.md` was absent here, so the supplied findings governed.
- Protected: `main` untouched; no schema rename, secrets, or force-push.
- Tip: `lane/l1_fix` at `HEAD` (last code commit `d74c832`). Gate: GREEN.
