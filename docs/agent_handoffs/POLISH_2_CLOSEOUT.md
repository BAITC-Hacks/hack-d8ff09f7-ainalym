# POLISH-2 closeout

Date: 2026-09-23. Branch: `lane/polish2`, based on `230b038d9c118146ff2ba9f59c7dacc394ead71e`. **Gate: YELLOW** — the requested priority-card styling is implemented and checks are green; one existing mobile overflow remains with UX-FIX-D. Work completed before the 12:25 UTC stop.

## Outcome

Priority metric/hero surfaces across all requested sections now share a white background, hairline border and soft low shadow. One shell class, `v2-priority-card`, owns the surface; shared tokens own muted 13 px labels, semibold tabular values and responsive value sizes. Existing grouped metric layouts are retained. Hero padding is 24 px on desktop and 20/16 px on phones. Secondary panels retain their warm surface and status colors retain their meaning.

| Page | Change |
| --- | --- |
| Сегодня `/today` | White pulse and loading strip; shared metric typography; linked risk tile hover feedback. |
| Закупки `/replenishment` | White hero; quieter table headers, right-aligned numeric headers and tabular group amounts. |
| Заказы `/orders` | White shared KPI strip; stronger tabular totals; link height, hover and focus consistency. |
| Поставщики `/suppliers` | White shared KPI strip; tabular totals, wrapping supplier heading and aligned buttons/focus. |
| Товары `/skus` | Existing page header opts into the white hero surface. Table/list implementation is unchanged. |
| Товар `/skus/[code]` | White metrics and recommendation card; shared metric labels and values. |
| Деньги `/money` | White shared KPIs and cost-completion summary. |
| Лента `/world` | White event-control panel; shell typography/control tokens, hairline fields and consistent radii. |
| Настройки `/settings` | White setup hero and cost summary; shared summary metric; wrapping source links and keyboard focus. |

Shared pill typography and control sizing/radii are consistent. Disabled shared buttons no longer shift on press. No structure, Russian copy, action handlers or data flow changed. No dependencies were added.

## Changed files

Source (17 files):

- `src/styles/v2/tokens.css`
- `src/components/v2/shell.module.css`
- `src/components/v2/ui.tsx`
- `src/components/v2/ui.module.css`
- `src/components/v2/primitives.module.css`
- `src/components/v2/SkuIndex.tsx`
- `src/app/(v2)/today/page.tsx`
- `src/app/(v2)/replenishment/page.tsx`
- `src/app/(v2)/replenishment/replenishment.module.css`
- `src/app/(v2)/orders/orders.module.css`
- `src/app/(v2)/suppliers/suppliers.module.css`
- `src/app/(v2)/skus/[code]/SkuCard.tsx`
- `src/app/(v2)/money/MoneyPage.tsx`
- `src/app/(v2)/settings/SettingsPage.tsx`
- `src/app/(v2)/settings/settings.module.css`
- `src/components/world-console/WorldControls.tsx`
- `src/components/world-console/world-console.module.css`

Handoff/evidence files: this closeout, `POLISH_2_PLAN.md`, `POLISH_2_REVIEW_SPEC.md`, `POLISH_2_REVIEW.md` in this directory; and the following files in `docs/evidence/polish2/`:

- `README.md`, `checks.json`, `measurements.json`
- `today-1440.jpg`, `today-1280.jpg`, `today-390.jpg`, `today-decisions-390.jpg`
- `replenishment-1440.jpg`, `replenishment-1280.jpg`, `replenishment-390.jpg`, `replenishment-empty-1440.jpg`
- `orders-1440.jpg`, `orders-1280.jpg`, `orders-390.jpg`
- `suppliers-1440.jpg`, `suppliers-1280.jpg`, `suppliers-390.jpg`
- `skus-1440.jpg`, `skus-1280.jpg`, `skus-390.jpg`
- `sku-detail-1440.jpg`, `sku-detail-1280.jpg`, `sku-detail-390.jpg`
- `money-1440.jpg`, `money-1280.jpg`, `money-390.jpg`
- `world-1440.jpg`, `world-1280.jpg`, `world-390.jpg`, `world-compose-390.jpg`
- `settings-1440.jpg`, `settings-1280.jpg`, `settings-390.jpg`, `settings-cost-1280.jpg`, `settings-cost-390.jpg`

## Verification

- `npx tsc --noEmit`: exit 0 before and after build; no stale generated-type exclusions needed.
- `env -u DATABASE_PATH AI_PROVIDER=rules npm run check`: exit 0; 325 passed, 0 failed, 7 skipped/externally unverified.
- `env -u DATABASE_PATH AI_PROVIDER=rules npm run build`: exit 0. Three existing Turbopack filesystem tracing warnings in unchanged `src/db/path.mjs:5`; no build failure.
- `git diff 230b038d9c118146ff2ba9f59c7dacc394ead71e --check`: clean.
- All nine surfaces rendered and visually inspected at 1440, 1280 and 390 px. All 1440 captures use the successful production build; Replenishment/Orders at 1280 also use settled production data. Computed surfaces, typography and overflow recorded in [evidence](../evidence/polish2/README.md).
- White card fill, 1 px border, shared shadow, muted 13 px labels and semibold tabular values verified. All measured pages fit their viewport except the existing Today decision section at 390 px.
- Empty Replenishment, its calculation busy-to-populated transition, World composition open/closed state and selected keyboard focus states were checked. No UI order approval, supplier transmission or event submission was performed.
- Fresh independent review found no introduced defect: [POLISH_2_REVIEW.md](POLISH_2_REVIEW.md). Its responsive score is limited by the existing Today overflow. Review and screenshots are evidence of the captured states, not a complete accessibility or state audit.

## Remaining gap and next route

**UX-FIX-D: Today at 390 px has document width 443 px after local calculation creates decisions.** The new priority strip fits at 358 px; overflow begins in the lower `.decisions` region. See [screenshot](../evidence/polish2/today-decisions-390.jpg) and [measurements](../evidence/polish2/measurements.json).

`src/app/(v2)/today/today.module.css:83` retains `grid-template-columns: 1fr`; `.decisions` at line 36 has automatic minimum width and is absent from the existing guard at line 100. The stylesheet and decision subtree are unchanged from the base. This is source-based attribution; a baseline browser render was not performed. The next legitimate route is for UX-FIX-D to address the decision column’s intrinsic width and long action text, then reproduce the populated state at 390 px and require document width of 390 px with readable actions. POLISH-2 did not cross that lane’s ownership boundary.

Full error/offline/stale-state coverage, complete keyboard traversal and live provider/microphone checks remain unverified. Shared-component consumers `/orders/[po_id]` and `/review/*` were reviewed in source but not rendered. The seven project-check skips require their respective live services/devices; they are recorded in [checks.json](../evidence/polish2/checks.json).

## Scope, assumptions and protected surfaces

- Main was never modified. Completed sections were committed separately; final source commit is `93cdb10`.
- Assistant, Chat, voice, CartPanel and documents source files were untouched. Today and Money CSS were untouched; `SkuIndex.tsx` changes only the page-header priority prop, leaving the concurrently owned table/list intact.
- Existing heroes serve as the priority surface on pages without KPI strips; no additional panels or labels were invented. Existing secondary/status presentation was preserved except the explicitly promoted cost-completion summaries.
- Data came from anonymized repository fixtures in this worktree’s ignored database; rules mode avoided paid provider calls. No shared or production database was modified. No credentials, personal names or absolute local paths were introduced in tracked work.
- No new test suite was added for this reversible CSS change. Existing checks, production rendering, measured styles and an independent review provide the relevant verification.
- The only acceptance deviation is the scoped-out, existing Today mobile overflow. **Gate: YELLOW; code checks: GREEN.**
