# POLISH-2 visual evidence

Captured 2026-09-23 on `lane/polish2`; final source changes are in `93cdb10`. Local, ignored worktree database seeded from the repository’s anonymized fixtures. The calculation used rules mode. No paid provider, supplier submission, production or external account mutation was used for this review.

## Viewports

The following nine stems each have `-1440.jpg`, `-1280.jpg` and `-390.jpg`: `today`, `replenishment`, `orders`, `suppliers`, `skus`, `sku-detail`, `money`, `world`, `settings`. These are viewport screenshots, not full-page captures. The detail route is `/skus/010300001_`.

All 1440 captures use the successful production build. Replenishment and Orders at 1280 were also recaptured from production after their data settled. Remaining 1280/390 captures use the development server with the same source. The primary agent and independent reviewer visually inspected all 27 standard captures.

Additional screenshots:

- `replenishment-empty-1440.jpg`: empty state before local calculation.
- `settings-cost-1280.jpg`: lower cost-completion summary.
- `settings-cost-390.jpg`: lower summary and keyboard focus on the source link.
- `world-compose-390.jpg`: expanded composition form and focused input; no submission.
- `today-decisions-390.jpg`: production capture of the remaining lower-page overflow, added after independent review.

## Measurements and interaction checks

`measurements.json` holds 30 distinct captures with viewport/document widths and computed priority-card, label and value styles. Repeat captures were replaced by the latest settled record. All measured priority surfaces are white with 1 px borders and the shared low shadow; metric labels are muted 13 px and metric values are semibold/tabular.

- All measured widths fit except Today at 390: document width 443 px, while the priority strip itself fits at 358 px. See [closeout](../../agent_handoffs/POLISH_2_CLOSEOUT.md) for attribution and the next route.
- Settings source-link keyboard navigation produced a visible 2 px focus outline at 390 px.
- World composition opened/collapsed with `aria-expanded` updating, and its input had a visible 2 px focus outline; width remained 390 px.
- Replenishment calculation transitioned from empty/busy to populated using the local rules provider. No supplier order was approved or sent through the UI.

`checks.json` records command results and explicit exclusions. Full error, offline, stale-data and keyboard traversal matrices were not exercised. Review conclusions are in [POLISH_2_REVIEW.md](../../agent_handoffs/POLISH_2_REVIEW.md).
