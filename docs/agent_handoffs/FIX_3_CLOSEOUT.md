# FIX-3 closeout
Gate: GREEN — `lane/fix3`; no UI files, schema renames, secrets, or main changes.
Export: PO lines retain `recommendation_id`; additive runtime migration; 1C urgency and rationale resolve from each line's recommendation.
Regression: a 294-line SE PO preserves critical/soon/normal export labels after one SKU's +100 in-transit event and recompute; legacy column migration passes.
Partner: the check runner passes the ETL resolver's disk path alongside its isolated in-memory test path; all six named checks pass.
Check: `npm run etl && npm run check` → `check: passed=230 failed=0 skipped=6 externally-unverified=6` (skipped before: 12).
Build: `npm run build` passed.
Tip: merge `lane/fix3` at HEAD; the remaining six skips are declared external verifications.
