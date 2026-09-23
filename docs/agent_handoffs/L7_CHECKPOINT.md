# L7 checkpoint — 09:48Z (main @ 9bd8972 merged)
- VERIFIED on a keyless clean clone of 9bd8972: README §7 steps (with DATABASE_PATH=./data/partner.db) → etl, check 203/0/3/0, scenario 10×PASS, dev; §8 API steps: calc SE → 300200745_ 126 → compose +100 → 24; approve SE proposal → PO → approve → export.xlsx 294 rows, 7 cols; supplier page «Черновик заказа — не отправлен»; money SE 67 449 839,07.
- done: README v1.7 · TASK_MAP @09:48Z (27 rows) · clean_clone_check.sh (local PASS @ 9bd8972) · SUBMISSION_RU v1.
- findings for root: export «Срочность» prints key "none" (not RU label) incl. a 57-unit line; after order approve GET /api/money next_60d.out = [] ; order total_cost null while money shows 67.4M; .env.example DATABASE_PATH mismatch (L1-FIX-1).
- queue: done 001–060+; queued 070/080; drafts 100–140 drip every 20 min.
