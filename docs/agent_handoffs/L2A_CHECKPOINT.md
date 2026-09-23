# L2a checkpoint — cross-lane integration
Done: 33/34 `a_*` tests pass; M1–M5 named data pass; proposal approval prepares a draft PO for L2b approval; params/outlier review and scheduled checks implemented; build and TypeScript pass.
Undone: domain check 56 pass/2 fail: strict no-float grep catches L2b `cashflow/events/obligations/orders`; L2b `recomputeAffected` test lacks sales source (engine correctly refuses). L1 ledger and queue/today routes pending; L3 tick still uses its own scheduled check.
Resumable: root/L2b resolve the two cross-lane test conflicts; merge main; exercise ledger, API curls and export when owners land.
SHA: this checkpoint commit (parent a0b1431).
