# L6 — world and peers closeout (2026-09-23)

## Before → after
- No runnable world feed → `src/world/feed.ts:3`, `play.ts:5`, `compose.ts:18` expose labelled, org-scoped events; `src/app/api/world/{feed,play,compose}/route.ts` exposes HTTP. Play emits scripted rows in `seq` order, then calls L3 `tick`; compose inserts a deduped pending row, then calls L3 `processEvent`. L6 does no event interpretation or business decision.
- No judge surface → `src/app/(peers)/world/[code_1c]/page.tsx:10` and `JudgeCompose.tsx:19` provide SKU-scoped presets and editable verbatim text for `judge_message`, `in_transit_update`, `price_update`; unknown SKU is 404.
- No supplier reply channel → `src/peers/supplier.ts:17`, `src/app/api/supplier/[po_id]/reply/route.ts:5`, `src/app/(peers)/supplier/[po_id]/page.tsx:11` show the prepared order and preserve the confirmation as a `supplier_reply` world event. The channel performs no external send.
- No export boundary → `src/peers/onec_export.ts:25`, `xlsx.ts:42`, `deliver.ts:5`, `src/app/api/peers/onec-export/[po_id]/route.ts:10` write/read CSV and XLSX after PO approval; `ledger_peer_record` provides idempotent export identity. Seven required columns; 1C code remains text.
- No peer view → `src/app/(peers)/peers/page.tsx:27` shows world rows, PO export controls, and the file registry with truthful labels; desktop and 390px screenshots are in `docs/evidence/peers/`.

## State and truth
| Surface | States | Axis and label |
| --- | --- | --- |
| `world_event` | scripted → pending → processed/failed; duplicate compose returns `replayed:true` | `external: local_simulator`; each row «Симулятор мира — синтетическое событие» |
| `supplier_channel` | Draft → Sent (controlled demo channel) → Confirmed | `external: local_simulator`; reply text verbatim; no email sent |
| `onec_export` | approved PO → exported; repeat returns `replayed:true`; failure returns `delivery_failed` | `external: export_only`; «Экспорт для 1С (файл)» |

World kinds: L9 scripts `sales_day`, `stock_snapshot`, `in_transit_update`, plus judge-composed `judge_message`, `in_transit_update`, `price_update`, and supplier `supplier_reply`. The world writes `world_event`; L3 owns `tick`/`processEvent`; L2 owns application and proposals.

## Evidence and gates
```text
npm run check -- peers: passed=9 failed=0 skipped=0 externally-unverified=0
npm run build: compiled, TypeScript and static page generation passed
npx tsc --noEmit: passed
POST /api/world/play {"steps":1}: WE-001 sales_day processed; emitted_at and processed_at set; processed=1
POST /api/world/compose twice: one in_transit_update row; second replayed:true
POST /api/peers/onec-export/PO-L6-LOCAL twice: exported; second replayed:true; one peer record
GET /api/peers/onec-export/PO-L6-LOCAL?format=xlsx: 200; seven columns and 1C text code read by openpyxl
GET /api/world/feed: 200; unknown supplier PO: 404
git grep -i 'odata\|1c_fresh\|EnterpriseData' on owned paths: no matches
```
The approved `PO-L6-LOCAL` was seeded directly in ignored local DB solely to test export; it was not an app approval. Partner reset loaded 45 scripted events. HTTP compose of an in-transit change led to a 700-unit recommendation and `needs_review` supplier-order proposal. See `docs/evidence/peers/INTEGRATION_20260923.md` and screenshots.

Dependencies added: none; `npm install` was run. Changed L6 source: `src/world/{feed,play,compose,http}.ts`, `src/peers/{supplier,onec_export,xlsx,deliver}.ts`, `src/app/(peers)/**`, `src/app/api/{world,peers,supplier}/**`; tests: `tests/peers/{world,supplier,export}.test.ts`; evidence: `docs/evidence/peers/{INTEGRATION_20260923.md,judge-compose.png,peer-view.png,supplier-confirmed.png,supplier-draft.png,world-mobile.png,world-partner-feed.png}`; handoffs: `docs/agent_handoffs/{L6_CHECKPOINT.md,L6_WORLD_PEERS_CLOSEOUT.md}`.

Unverified/failed integration: WE-003 `stock_snapshot` fails because L2b reads `payload.lines/rows`, while L9 supplies `payload.stocks`; L9 judge presets also use `payload.line`, `delta_qty`, `to`. L2b must map those shapes, then replay all 45 events. L1's ledger remains a stub (`RUN-STUB-*`, zero `agent_run` rows); L1 must land persisted runs and the owning `/api/orders/:id/export.(xlsx|csv)` route, then root reruns the full gate. `outlier_doc` stayed empty after a processed one-off judge message; L2a/L3 should verify that row. Default `npm run demo:reset` works; a custom `DATABASE_PATH` does not propagate to ETL child (L9/root). Until those are repaired, full acceptance is unverified.

Protected surfaces: no fixture edits, live 1C call, real peer endpoint, credential use, external supplier send, or government/bank/customs claim. Local ETL has no `organization` row, so L6 resolves the single org from the scripted feed; foreign org is 404. Mobile event table scrolls horizontally. Next route: land L2b payload mapping and L1 ledger/export route, reset partner DB, replay all 45, verify proposal→approval→PO→file through app routes.

Gate: RED
tip: 7e1d660
