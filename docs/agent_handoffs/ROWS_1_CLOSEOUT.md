# ROWS-1 closeout — bigger SKU rows/images, no far-right drift (lane/rows)

Brief: `ops/briefs_go/ROWS_1.md` (owner verdict D-H76, 12:13Z; scope additions 12:14Z /documents, 12:16Z /suppliers header + KPI group).
Branch `lane/rows` cut from main `56ee09c`. Two commits: item 1 alone first, then the sweep.

## Commit 1 — /skus table
- `src/components/v2/SkuIndex.tsx` — list is now a dedicated table (no shared `Row`): thumbnail cell, name column with
  «код · арт. · поставщик · категория» and «остаток · кратность» stacked under the name, the «себестоимость не задана» pill under them;
  numeric columns «остаток» and «себестоимость» right-aligned, tabular. Hover/tap preview kept, size 300 → 360. «Показано N из M»
  sits next to the filters (no `margin-left: auto`). Sorting/search/paging untouched.
- `src/components/v2/SkuIndex.module.css` (new) — `.tr` grid `56px | 1fr | 132px | 148px`, min-height 72, thumbnail 56×56
  (64 and wider columns on ≥1440); ≤767 stacks the numeric cells under the name.
- `src/components/v2/ui.module.css` — `.thumbPop` width 300 → 360.

## Commit 2 — sweep (CSS only, no copy/behaviour change)
- `src/components/v2/ui.module.css`
  - `.head` and `.sectionHead`: `space-between` → `flex-start` (page-header primary button sits next to the headline, gap 24 / 16).
  - `.row`: `flex-start`; `.rowText` `flex: 0 1 48ch`; `.rowValue` `min-width: 140px` — money/value column stays right-aligned
    inside its own column but sits right after the text (phones: text flexes, no min-width). Used by /orders, /orders/[id], /settings, /skus/[code].
  - `.kpis`: `width: 100%; max-width: 960px; margin: 0 auto 36px` (compact centred group shared by /today, /orders, /suppliers, …); 2×2 breakpoint 1100 → 900.
- `src/app/(v2)/today/today.module.css` — `.head`, `.outlookHead`, `.listRow` → `flex-start`; `.outlookLegVal`, `.more`, `.reviewLink`, `.linkBtn` lose `margin-left: auto` (fixed 12–16 px).
- `src/app/(v2)/replenishment/replenishment.module.css` — `.head` → `flex-start`; `.groupSum`, `.skuLink` lose `margin-left: auto`. `.pager` kept (pagination).
- `src/app/(v2)/suppliers/suppliers.module.css` — `.cardHead` → `flex-start`.
- `src/app/(v2)/skus/[code]/sku.module.css` — `.recTop` → `flex-start`, gap 16.
- `src/app/(v2)/review/[id]/review.module.css` — `.head` → `flex-start`; `.sort`, `.linkBtn` lose `margin-left: auto`.
- `src/app/(v2)/money/money.module.css` — `.riskTop` → `flex-start`, gap 16.
- `src/components/documents/documents.module.css` — `.drop`, `.draft summary`, mobile `.stages li` → `flex-start`; `.item` (document page lines) `minmax(0, 48ch) auto auto` + `justify-content: start`.
- `src/components/v2/CartPanel.module.css` — `.supHead` → `flex-start`. Panel `.head` kept (close button is a genuine trailing action).

Kept right-aligned on purpose: shell bar (`shell.module.css`), pagination `.pager`, cart-panel close, bar tooltip label/value.

## Remaining gap
- /documents inbox table (`.thead, .tr`, 8 fr-columns) still spreads across the full width — a true multi-column table; tightening it
  needs fixed column widths and a check at 1024–1440, not done in the 12:26Z window.
- Visual pass at 390 / 1440 not screenshot-verified in this lane (deadline); rules follow the same breakpoints as before.

## Checks
- `npx tsc --noEmit`: clean (ignoring stale `.next/types`).
- `npm run check` / `npm run build`: see final message.
