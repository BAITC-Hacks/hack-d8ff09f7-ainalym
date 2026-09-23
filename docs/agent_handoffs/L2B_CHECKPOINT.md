L2b checkpoint — real partner data
Done: routes, SKU drilldown, durable affected-only recompute, 45-event replay, money and obligations.
Evidence: domain check 50/50; HTTP money 200, order approval 200 then stale 409; two installments visible.
Scenario: M1 active shortage Δ−100 on partner SKU 010300014_; M2–M4, M5 subset, Money, World PASS.
RED: full SE run stops at no-sales SKU 030200010_ (L2a runCalculation); scenario reports M5-full FAIL.
Undone: --via-api, worker integration, closeout.
Resumable: merge main; keep the full-run failure visible until L2a handles inactive SKUs.
SHA: HEAD after this checkpoint commit.
