done: L1 routes, repositories, ETL reset, ledger, inbox, /skeleton, CONTRACTS v1, seven skeleton tests.
undone: full check has two L2 domain failures; /api/health live response is intercepted by L8 middleware; closeout.
resumable: L2a money test rejects Number() in cashflow.ts; L2b recompute test uses SE-1 with missing sales. L8 must let /api/health fall through to L1 handler (it now includes demo_guard fields).
checks: build and tsc green; skeleton 7/7; full check passed=60 failed=2; reset twice identical; SE example 560 SKUs/291 recommendations/one proposal.
sha: HEAD (this checkpoint commit).
