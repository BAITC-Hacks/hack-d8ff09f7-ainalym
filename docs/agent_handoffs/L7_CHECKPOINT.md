# L7 checkpoint — 09:02Z (main @ 02b088e)
- lane/docs REBUILT on main: the earlier branch had merged 2b29bd2 (L2b, since dropped from main); old tip kept as local ref `l7-backup-with-l2b`. This branch carries only L7 files.
- done: README v1.4 (§3 = main incl. L3/L8; methodology + outlier algorithm from src/domain/engine.ts) · TASK_MAP @09:01Z (28 rows) · scripts/clean_clone_check.sh · docs/SUBMISSION_RU.md v1.
- check @09:00Z (with keys): passed=26 failed=0. Queue: 010 done, 020 queued, 030–060 released now; new items every ≈20 min.
- for root: docs/DEMO_ACCESS.md says «Live AI on a synthetic company» — this case uses partner data.
- FINDING (engine on partner data, as_of 2026-09-22, main @ af5c9ac, read-only run): `oneoff` 010500008_ doc 20000099834 (7 488) is NOT excluded — threshold = max(3×14 502, 5×144, 20) = 43 506; U733M 130300027_ excludes nothing (threshold 3 370; docs 1 960, 1 457 kept), growth clamped ×0.5, safety 1 705 > forecast 1 650, on_hand = September opening stock 6 (file «Свободный остаток» 108 is not a source) → need 3 360. For L2a/root; README states the rule as coded, claims M4 only on test data.
- undone: routes/UI/voice/scenario.mjs → README/TASK_MAP; SUBMISSION refresh ≈T+190; remote clean clone ≈12:10Z; README final ≈12:40Z.
