# L2a checkpoint — engine, decisions and views
Done: money, need engine, proposals, tasks, schedule and views committed; main through e5b60fa merged. Named M1–M5 and all 10 scenario checks pass; peers 9/9; domain 74/77 including strict no-float scan. Caller-database ledger wiring and its regression test are committed; build and TypeScript pass.
Undone: three ledger tests await L1's persisted ledger on main; queue/today HTTP needs L1 routes and a server; L3 tick still calls its own schedule.
Resumable: merge main when L1 lands, rerun domain and HTTP gates, then refresh closeout evidence.
SHA: 84bbc8f (latest domain implementation commit before this checkpoint).
