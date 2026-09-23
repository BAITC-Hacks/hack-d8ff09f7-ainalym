# DOMAIN-FIX-1 closeout
Branch: `lane/domain_fix`; three cause fixes committed; hosted calc failure remains unverified.
Export `2da457e`: canonical contract RU urgency in CSV/XLSX; `src/domain/urgency.ts`, `src/peers/onec_export.ts`, `tests/peers/export.test.ts`.
Money `1947bd1`: approved mixed-cost POs schedule 30/70 installments over known priced lines; `src/domain/obligations.ts`, `tests/domain/b_money_orders.test.ts` (GET route).
Order `c1955c1`: GET derives known line sum and `unknown_cost_lines`; `src/domain/orders.ts`, `tests/domain/b_money_orders.test.ts` (GET route).
Check: `npm run etl && npm run check` → `check: passed=212 failed=0 skipped=6 externally-unverified=6` (exit 0).
Build: `npm run build` → compiled, TypeScript, and static generation passed (exit 0).
Hosted probe: `DATABASE_PATH=./data/partner.db AINALYM_MODE=live AI_PROVIDER=rules PORT=3311 npm start`; `curl -d '{"scope":{}}' .../api/calc/run` → HTTP 200, 1.944 s, `skus=2936`, `recommended=1259`.
Standalone probe: staged `output: "standalone"`, copied deployed `src/fixtures/scripts`, `AINALYM_WORKER=1 PORT=3311 node server.js`; same POST → HTTP 200, 2.087 s; repeat → HTTP 200, 2.090 s; concurrent `/api/agent/tick` → 200 and calc → 200.
Tip: obtain the hosted `journalctl -u ainalym` `[api] internal_error` line and DB state at failure, then reproduce against that state; no local error line appeared, so no speculative fourth code change was made.
Assumption: mixed-cost installments represent the priced portion only; unknown cost remains counted. No UI, schema rename, secret, `main`, or force-push touched.
Gate: YELLOW — three defects fixed and gates green; hosted 500 cause still unknown.
