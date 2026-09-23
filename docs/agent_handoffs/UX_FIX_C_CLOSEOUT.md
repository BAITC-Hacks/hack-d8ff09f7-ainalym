# UX-FIX-C closeout — non-technical interface (Today, SKU card, Orders, Feed, phone)

- Today: `/api/tasks` note, `purchasing_manager`, `needs_review → ready_to_handover`, task/PO ids, «SKU», route names in tooltips replaced via `src/components/labels` (`roleLabel`, `orderStateLabel`, `humanize`); task note now neutral grey.
- SKU card: «ETA» → «дата поставки»; outlier rule reads «крупнее N шт считаем разовым заказом» (no p95/max/min).
- 1С export: `ExportButton` fetches same-origin (cookie travels), saves `Заказ_поставщику_<SE|IEK>_<date>.xlsx`; plain errors for unapproved / empty (`empty_po`) / missing file; export hidden until approval; Orders docs row notes «после утверждения».
- Orders list: primary «Утвердить заказ» on each draft card (same POST + version/409 handling as the order page), receipt line, links to Деньги and export, secondary «Открыть»; judge/scripted transit rows read «Демо-событие: +N шт в пути по …» without ids.
- Feed: empty state explains the feed in one line and offers «Показать демо-события» → `POST /api/world/demo` (seeds `fixtures/world_events.jsonl` if the org has no events, plays 3); kinds/actors mapped to purchasing labels; texts humanized.
- Phone 390×844: eight routes ≤ 390 px verified; `/replenishment` overflows to 411 px from `.chips` in its own stylesheet (other lane; needs `min-width: 0; overflow-x: auto` or `flex-wrap: wrap`) — recorded as an annotated expected failure in the spec.
- Checks: `npm run etl && npm run check` 301 passed / 0 failed / 7 externally-unverified (unchanged); `npm run build` OK; `npx tsc --noEmit` clean; `npx playwright test -c tests/e2e/uxfix_c.config.ts` 6/6 against a local dev server (no-technical-terms regex over /today, /skus/010300008_, /orders, /world; download; phone widths).
- Evidence: `docs/evidence/v2/uxfix_c/{today,world}_{desktop,phone}.png`.
- Unverified: the empty-feed button branch was exercised at API level only (local feed already has 46 events); hosted deploy not re-walked from this lane.
- Gate: YELLOW — all owned surfaces GREEN; one phone overflow remains in the replenishment lane's stylesheet.
