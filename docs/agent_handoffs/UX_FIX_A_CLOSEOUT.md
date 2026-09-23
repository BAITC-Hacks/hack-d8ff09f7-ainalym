# UX-FIX-A closeout — Закупки / Заказы / Поставщики / Товары (lane/uxfix_a)

- Закупки: row action «В черновик» → «Добавить в корзину» + helper «Попадёт в заказ поставщику»; header always shows «Подготовить заказ <поставщик>» (on «Все»: one button per supplier with line count) and «Подготовить сообщение поставщику» (letter draft on /orders/<po>, drafts only); grey hint removed.
- Calc control (judge finding): header «Рассчитать заказы» / «Пересчитать» + last-run timestamp, POST /api/calc/run scoped to the selected tab, spinner line while running, result «Рассчитано N позиций, рекомендаций M», disabled with reason during a run.
- Sorting: every column header is a button (Позиция a/z, Срочность by rank, numbers numeric), visible arrow, `aria-sort`, keyboard, persisted as `?sort=key:dir`; unknown values sink to the bottom.
- Conditional formatting via `stakeTier()` (≥ 1 000 000 KZT strong, ≥ 100 000 medium; shell tokens only): Заказать/Стоимость cells, order totals on /orders (overdue days red, ≤ 3 days amber), committed money on /suppliers.
- Language: «страховой запас — чтобы покрыть 90 % колебаний спроса», «обычные продажи … (медиана …)», «разовые заказы …», «строк продаж»; rationale under «Пояснение расчёта» with «Артикул …» (engine untouched, presentation only).
- Товары: 28 px lazy thumbnail (image_url from /api/skus) or neutral placeholder before the name.
- Files: src/app/(v2)/replenishment/{page.tsx,replenishment.module.css}, src/app/(v2)/orders/{OrdersView.tsx,orders.module.css}, src/app/(v2)/suppliers/{SuppliersView.tsx,suppliers.module.css}, src/components/v2/{primitives.tsx,ui.tsx,ui.module.css,SkuIndex.tsx}, tests/ui_v2/{uxfix_a.spec.ts,approve.spec.ts,playwright.config.ts}.
- Checks: `npm run etl && npm run check` GREEN (301 passed / 0 failed); `npm run build` GREEN; `npx tsc --noEmit` clean; Playwright `uxfix_a` project (sorting numeric + text + URL persistence, basket label, «Все» buttons, SKU thumbs) and `desktop -g Replenishment` — 4 + 4 passed against the built app on a lane port with a fresh calc run (3 909 SKU, 1 435 рекомендаций).
- Evidence: docs/evidence/v2/uxfix_a/replenishment_cost_desc_expanded_1440x900.png, skus_index_1440x900.png.
- Not touched: Shell.tsx (shell search thumbnails), assistant/voice/money/connections, src/domain/**.
- Gate: GREEN
