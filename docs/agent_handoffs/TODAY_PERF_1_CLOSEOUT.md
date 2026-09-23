# TODAY-PERF-1 closeout
Cause: `todayView` repeated a latest-recommendation subquery per SKU; queue read every open task and returned full source lists.
Fix: latest run per supplier query, bounded queue summaries and batched lookups; each new supplier proposal stales all prior open proposals in its insert transaction.
Indexes: existing `recommendation_run(run_id,supplier_id)` plus additive `proposal(org_id,state,created_at)` and `calc_run(org_id,started_at)`.
Before, four runs: today 8.279 s / 21,878 B; queue 0.082 s / 111,872 B; recommendations 0.092 s; money 0.093 s; ledger 0.059 s.
After, fresh four runs: today 0.217 s / 4,200 B; queue 0.042 s / 4,353 B; recommendations 0.028 s after batching; money 0.095 s; ledger 0.042 s.
State: 2 open latest-run supplier proposals, 6 stale in history; queue also has 2 deduplicated source-gap tasks.
Check: `npm run etl` GREEN; `npm run check` 226 passed, 0 failed, 6 externally unverified; `npm run build` GREEN; `git diff --check` GREEN.
Tip: for the documented `partner.db` dev command, load that file with `npm run etl -- --db ./data/partner.db`; plain ETL uses `ainalym.db`.
