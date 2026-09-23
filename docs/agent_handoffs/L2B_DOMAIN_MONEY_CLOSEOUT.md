# L2b — purchase orders, money, world events (D-H46)

Outcome: purchase-side domain and routes implemented against partner SKU/PO data. Old trading/receiving examples were superseded by the case reframe.

## Before → after
- Seam stubs → version-bound PO approval and export state: `src/domain/orders.ts:22`, `src/app/api/orders/[id]/approve/route.ts:7`.
- No supplier money rows → 30% approval prepayment, 70% ETA balance, deterministic IDs and idempotent sync: `src/domain/obligations.ts:10`.
- Empty money stub → per-currency cash, supplier commitments, overdue/next-60-day obligations, known stock value and unknown-cost/cash risks: `src/domain/cashflow.ts:18`, `src/app/api/money/route.ts:4`.
- Empty event stub → sales days/returns, stock, in-transit, explicit one-off judge documents, prices, `(org_id,source_id)` replay guard and ledger calls: `src/domain/events.ts:30`.
- Empty SKU stub → searchable catalog and series/forecast/recommendation/timeline detail: `src/domain/skus.ts:32`, `src/app/api/skus/route.ts:7`.
- No affected-only persistence → scoped calc run and recommendation IDs: `src/domain/recompute.ts:5`.
- No 1C download routes → CSV/XLSX delivery seam: `src/app/api/orders/[id]/_export.ts:5`; writer implementation awaits L6 merge.
- No scenario → reset copies, five judge checks, economics/money view and 45-event replay: `scripts/scenario.mjs:31`.

## Economics from partner-data scenario (SE, KZT)
| Qty | Unit cost | Commitment | Prepayment | ETA balance |
|---:|---:|---:|---:|---:|
| 93 | 3,049 | 283,557.00 | 85,067.10 | 198,489.90 |

| Money view | Before approval | After approval |
|---|---:|---:|
| Cash | unknown (no opening row) | unknown |
| Known SE commitment | 0 | 283,557.00 KZT |
| Open outflow within 60 days | 0 | 85,067.10 + 198,489.90 KZT |
| Known stock value | 144,170,631.00 KZT | 144,170,631.00 KZT |
| SKUs without unit cost | 3,417 | 3,417 |

Rules: approval binds `purchase_order.version`; a repeated approval is rejected. Obligations use supplier `prepayment_pct`/`prepay_pct` (30% default), due now and at PO ETA; settled rows stay settled. Unknown-cost lines never create a fabricated full obligation; commitment is nullable when no line is priced. No currencies are summed.

Evidence: `npm run check -- domain` passed=50 failed=0; `npx tsc --noEmit` and `npm run build` GREEN. Local HTTP: `/api/money` 200, `/api/skus` 200, PO approval 200 then stale 409; both installments visible after approval. Direct scenario: M1 (including active-shortage SKU `010300014_` Δ−100), M2, M3, M4, M5 scoped rows, Money and World 45/45 PASS.

Remaining: full SE scenario run is RED on base `main` (`sales source missing for 030200010_`); L2a's newer branch handles inactive SKUs but is not merged here. L1's persistent ledger and L6's writer/world API have not landed on `main`; `--via-api` and actual CSV/XLSX downloads are unverified. Next route: root merges L2a/L1/L6 checkpoints, this lane merges `main`, reruns domain/scenario/API gates, and updates this closeout.

Additive schema changes: none. Dependencies added by this lane: none. Protected: fixtures, L2a files, UI, and `main` were not edited. Gate: RED.
tip: 8086aa7
