# ADJUST-FIX-1 closeout
Outcome: Event-local recompute carries `qty_adjusted`, `adjust_reason`, and the recommendation version forward; the new proposal line and recommendation API expose `needs_review` when adjusted quantity exceeds the new calculation.
Before → after: manager's 132 шт adjustment disappeared after +100 in transit; now 126 → 24 calculation retains 132 шт, version 2 → 3, and the proposal supersedes the prior version.
Ledger: «Корректировка 132 шт сохранена; после события расчёт изменил рекомендацию 126 → 24 — проверьте».
M3 `300200898_`: raw 20.84 шт/мес; corrected 19.522 → 21.541 шт/мес on the same eligible months, including inferred stockout months 2026-03/04.
Evidence: `tests/ai/adjustment_recompute.test.ts` verifies event, proposal, ledger, list and detail APIs; `tests/domain/stockout_real.test.ts` verifies the ETL SKU and rationale.
Checks: `npm run etl`; `npm run check` 315 passed, 0 failed, 7 external live checks unverified; `node scripts/scenario.mjs` 11 PASS; `npm run build`; `npx tsc --noEmit`; `git diff --check`.
Scope: `src/domain/apply.ts`, `src/domain/engine.ts`, `src/server/recommendations.ts`, `src/app/api/recommendations/route.ts`, the two tests, `docs/CONTRACTS.md`, `docs/METHODOLOGY_RU.md`, and this closeout; protected v2/components/voice/provider files untouched.
Gate: GREEN for requested local gates; external live checks remain unverified.
