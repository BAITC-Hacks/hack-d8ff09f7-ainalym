done: L1 routes, repositories, ETL reset, ledger, inbox, /skeleton, CONTRACTS v1, seven skeleton tests.
undone: full check has two L2 domain failures; remaining live gate and closeout.
resumable: domain/a_money.test.ts rejects Number() in cashflow.ts; domain/b_money_orders.test.ts expects recomputeAffected on SE-1 with missing sales. L2 owners must resolve or correct fixture.
checks: build and tsc green; npm run check skeleton passed=7 failed=0; full check passed=60 failed=2.
sha: HEAD (this checkpoint commit).
