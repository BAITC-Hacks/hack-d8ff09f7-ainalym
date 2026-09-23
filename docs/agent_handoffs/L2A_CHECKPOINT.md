# L2a checkpoint — integrated domain gate
Done: money, need engine, proposals, tasks, schedule, views, and proposal routes; L1 ledger/routes merged. Domain 79/79, scenario 11/11, peers 15/15, build and TypeScript pass. Local HTTP queue/today agree on the first decision; stale approval returns 409.
Undone: L3 tick still calls its own scheduled checker; the UI quantity editor calls an absent recommendations adjust route outside this lane's write scope.
Resumable: root/L3 wire tick to `src/domain/schedule.ts`; route owner exposes `adjustRecommendation`; rerun their integration checks. L2a domain and HTTP gates need no further code.
SHA: a6310c0 (latest domain implementation commit before this checkpoint).
