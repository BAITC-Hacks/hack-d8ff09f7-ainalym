# L2a checkpoint — main integration
Done: latest main merged with on-hand snapshot and L2b money formatting; named M1–M5 pass; domain check 74 pass/2 fail; strict no-float and L2b recompute tests now pass; TypeScript passes.
Undone: two ledger tests await L1's persisted ledger on main; queue/today HTTP after L1 merge; L3 tick still uses its own scheduled check.
Resumable: merge L1 main checkpoint, rerun domain/HTTP gates and scenario; closeout with final evidence.
SHA: this merge commit (parent 7862095).
