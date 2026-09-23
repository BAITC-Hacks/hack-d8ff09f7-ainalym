# ENGINE-FIX-1 closeout
1 `deduplicates 30 approved units already represented by matching 30 in transit` — need 20 → 50.
2 `keeps a sole legitimate 100-unit document instead of excluding it at threshold 20` — need 0 → 100; manual review flagged.
3 `keeps regular demand at 30 when a 5000-unit world document is excluded` — regular rate 27.5 → 30.
4 `preserves a late ETA after +1 transit` — need 0 → 80; 101 units retain the late date.
5 `keeps B in the basket API when the latest partial run drops A` — API groups 0 → 1; B appears once.
6 `shows the approved 30 deduction in the 80 to 50 need formula` — displayed approved deduction absent → 30.
SHOULD: mixed X/Y event finishes partially and APIs name Y; undated transit explains inclusion; comparisons match article and unit; visible terms use «артикул», «восстановление спроса при дефиците», «дата поставки».
Checks: `npm run etl && npm run check` 275 passed, 0 failed; `node scripts/scenario.mjs` 11 PASS; `npm run build` and `npx tsc --noEmit` clean.
Protected surfaces and main untouched; seven live checks remain externally unverified.
Gate: GREEN
