# L3-FIX-1 closeout
Baseline after the smoke gate and first `main` merge: ETL complete; check 154 passed, 0 failed.
0. `tests/ai/live_smoke.test.ts`, `tests/ai/draft_live_smoke.test.ts`: live calls require `AINALYM_LIVE_SMOKE=1`; absent key uses `ctx.skip("UNVERIFIED: …")`; no test loads `.env.local`. Test: default check skips four provider calls.
1. `src/server/ledger.ts` (L1 merge), `src/domain/apply.ts`, `src/domain/recompute.ts`, `src/domain/tasks.ts`, `src/ai/worker.ts`: persist one worker run and its actions; reuse that run through calculation. Test: `tests/ai/worker_integration.test.ts` checks rows and no nested calc run.
2. `src/ai/worker.ts`, `src/domain/apply.ts`: worker recompute key is `worker:<event>:recompute:<SKU>`, distinct from event application. Test: worker integration asserts two distinct persisted keys.
3. `src/domain/apply.ts`: partial supplier proposals carry unaffected lines, rationale, sources, and version; zero need creates no empty proposal. Test: `tests/ai/partial_recompute.test.ts`.
4. `src/db/client.ts`, `src/domain/events.ts`, `src/ai/worker.ts`: additive claim time/attempt/stage migration; stale claims resume without double source application; processed follows recompute. Test: worker integration reclaims an applied event.
5. `src/ai/decisions.ts`: cache key binds evidence values and versions. Test: `tests/ai/guardrails.test.ts` changes 80→120 across threshold 100.
6. `src/domain/engine.ts`, `src/ai/interpret.ts`, `src/ai/worker.ts`: review uses engine median, p95, threshold; conflicting inbox threshold is ignored. Test: `tests/ai/worker.test.ts` supplies a false threshold.
7. `src/ai/drafting.ts`: metadata and rendered supplier artifacts say «Черновик заказа — не отправлен». Test: `tests/ai/drafting.test.ts` checks both.
P2: `src/ai/replay.ts` maps increasing summaries to a stable recorded subject; `tests/ai/decisions.test.ts` checks increased and unsupported decreased cases.
Merge: integrated `main` through 9bd8972, including L1 real ledger and L2 core; upstream UI files were merged without lane edits. The empty-proposal edge fix has its own follow-up commit; no history was rewritten.
Check: `npm run etl` completed; `npm run check` → passed=205 failed=0 skipped=6 externally-unverified=4.
Build: `npm run build` passed, including TypeScript; no live provider call was made.
Protected: no lane UI changes, secrets, force-push, or direct `schema.sql` edit; schema changes in this lane are runtime-additive only.
Gate: GREEN
tip: lane/ai_fix
