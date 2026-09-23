# INTEG-1 closeout — lane/integ

- Engine — `src/domain/engine.ts`, `tests/domain/a_engine.test.ts`, `scripts/scenario.mjs`: per-SKU empty sales/stock aborted a supplier run; inactive SKUs now yield forecast/need 0 and `inactive`, while a missing supplier source still refuses. Unit and M1-source/M5-full pass (724 SE rows). Commit `0c078de`.
- Money — `src/domain/money.ts`, `src/domain/cashflow.ts`: amount formatting and quantity conversion now use Decimal and the shared two-decimal formatter. Money and float-guard tests pass. Commit `59030cb`.
- Organization — `scripts/etl/load.mjs`: ETL omitted the partner row; idempotently seeds `partner` / ТОО «Электрокомплект», preserving payload. ETL and world-feed tests pass. Commit `e1d764d`.
- Precision and stockouts — `scripts/etl/load.mjs`, `scripts/etl/derive.mjs`, `fixtures/PROVENANCE.md`: formatted cells rounded SE costs and negative known opening stock was flagged; raw numeric cost `300200428_` is `1050.61`, flags are 1,591. ETL assertions pass. Commit `2c0467e`.
- One-off rule — `src/domain/engine.ts`, `docs/PRODUCT.md`, `tests/domain/a_engine.test.ts`, `tests/fixtures/eval/replenishment_expectations.json`: high-volume SKU threshold was too loose; now `max(20, min(3 × median month, 5 × p95 document))`. Eval threshold is 720; document `20000099834` and an injected 5,000-unit document are excluded, with <10% regular-rate change. Unit/M4 pass. Commit `2c0467e`.
- L6 feed — merged `lane/world` as `b4fad07`; scripted feed/worker seam test passes without an additional patch.
- Fresh on-hand — `src/db/schema.sql`, `src/db/client.ts`, `src/db/repo/index.ts`, `scripts/etl/load.mjs`, `src/domain/engine.ts`, `tests/domain/a_engine.test.ts`, `tests/etl/counts.test.ts`, `fixtures/PROVENANCE.md`: monthly opening stock was stale; additive SKU fields hold SE free stock and IEK opening less outgoing through 22 September. SE `300200745_` uses 23 rather than 181; tests cover dated use and fallback. Commit `38c3e80`.

Check: `npm run etl && npm run check` GREEN — 85 passed, 0 failed, 0 skipped; `npm run build` passed.
Protected: `README.md`, XLSX files, and `docs/CONTRACTS.md` were not edited; CONTRACTS still states the old outlier formula by the explicit STOP rule.
Tip: `lane/integ` (last code fix `38c3e80`); no merge into `main` performed.
Gate: GREEN for executable acceptance; CONTRACTS wording awaits the contract owner.
