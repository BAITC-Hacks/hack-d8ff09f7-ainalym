# MERGE-4 closeout
- `lane/merge4` merged `lane/ekt` tip `675d766` from main `c9680b2`; only the three expected API routes conflicted.
- `src/app/api/recommendations/route.ts`: kept adjustment `version/state/proposal_id/adjust_reason`, EKT URL/stock, and registry image with EKT image fallback.
- `src/app/api/skus/[code]/route.ts`: kept the existing SKU view and registry image with EKT fallback, plus the complete `ekt` block in both response paths.
- `src/app/api/skus/route.ts`: kept list fields and registry image with EKT fallback, plus EKT URL/stock.
- Unconflicted EKT adapter, snapshot/mapping scripts, status route, contract, deployment configuration, fixture, and tests landed with the merge.
- Check: `npm install && npm run etl && npm run check` GREEN; 3,909 SKUs; 248 passed, 0 failed, 7 declared external checks unverified.
- Build: `npm run build` passed; Next middleware deprecation and filesystem tracing warnings remain.
- Protected: no write to `main`, fix reverted, secret added, or force-push.
- Tip: merge commit `1447f64` on `lane/merge4`; this closeout follows as a documentation commit. Gate: GREEN.
