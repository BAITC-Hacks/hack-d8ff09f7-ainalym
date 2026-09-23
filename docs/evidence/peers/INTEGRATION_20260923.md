# L6 integration evidence — 2026-09-23 09:09Z

Local process: `AI_PROVIDER=rules DATABASE_PATH=<worktree>/data/partner.db npm run dev`. No external peer endpoint was used. `npm run demo:reset` loaded 45 `scripted` world events; organization rows = 0, so L6 resolves the single org from the scripted feed.

- `npm run check -- peers`: `passed=9 failed=0 skipped=0 externally-unverified=0`.
- `npm run build`: passed after the L2b/L3 merge.
- `POST /api/world/play {"steps":1}`: `WE-001 sales_day processed`, `emitted_at` and `processed_at` present, `processed=1`.
- `POST /api/world/compose` twice with an identical `in_transit_update` body after L2b/L3 merge: one processed row, second `replayed:true`; `010500006_` in-transit total moved from 30,000 to 30,100 on a separate one-SKU event.
- A second `in_transit_update` for `130300608_` was `processed`; its recommendation was 700 units and a `supplier_order` proposal entered `needs_review` for IEK. The event's original text stayed on `world_event`.
- `judge_message` with a top-level 47,857-unit line dated 2026-08-22 was `processed`; the `sales_line` kept that date, and the rules decision recorded `one_off_order=one_off`. `outlier_doc` was still empty for that SKU.
- A test-only approved `PO-L6-LOCAL` was seeded directly in the local database from the 700-unit recommendation (this was **not** an app approval). Two `POST /api/peers/onec-export/PO-L6-LOCAL` calls returned `exported` then `replayed:true`; the downloaded XLSX opened in `openpyxl` with the seven required columns and the 1C code preserved as text. The supplier channel moved `draft → sent → confirmed`, and its verbatim 700-unit reply entered `world_event` as `processed`. Peer records show one `onec_export` and one `supplier_channel` entry.
- `POST /api/world/play {"steps":2}` emitted `WE-002 sales_day processed` and `WE-003 stock_snapshot failed`. L2b's `applyWorldEvent` reads top-level payload or `lines`/`rows`, while L9's stock snapshot uses `payload.stocks`; the same mismatch affects L9's `judge_message` action presets (`payload.line`, `delta_qty`, `to`). L2b owns that interpreter.
- `agent_run` rows remained 0 and `run_id` used `RUN-STUB-*`; L1's persisted ledger seam has not landed. The full ledger gate is unverified.
- `npm run demo:reset` succeeds at its default DB path. `DATABASE_PATH=/tmp/l6-partner.db npm run demo:reset` fails because the ETL child writes the default `data/partner.db` while reset opens `/tmp/l6-partner.db`; this is outside L6's edit scope.

Screenshots in this directory: partner feed, peer view, judge compose, supplier draft, supplier confirmation, and a 390px mobile world feed. The draft screenshot used a temporary local `PO-L6-DRAFT` copy removed after capture; the confirmation screenshot shows the test-only `PO-L6-LOCAL`. The mobile feed keeps the event table in a horizontal scroll container. The PO export HTTP path implemented here is `/api/peers/onec-export/:po_id`; `/api/orders/:id/export.(xlsx|csv)` still needs its owning route.
