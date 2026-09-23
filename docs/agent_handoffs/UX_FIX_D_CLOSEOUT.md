# UX-FIX-D closeout — Today chart, SKU image hover, Money hero metrics (D-H67, owner verdict #4)

Branch: `lane/uxfix_d` (cut from main 9b3bbb0). Commit SHA: see final lane message / `git log lane/uxfix_d -1`.

## What was built

1. **/today — 60-day money outlook chart** (`src/app/(v2)/today/page.tsx`, `src/app/(v2)/today/today.module.css`)
   - New `Outlook` block directly under the pulse strip, fed by the real `/api/money` view (cash balance + `next_60d.out`).
   - Hand-drawn inline SVG (viewBox 800×200, no library): cash-balance step line with a light area, weekly supplier-payout bars (9 weeks), dashed «сегодня» marker, red dashed «деньги кончаются» marker when the balance crosses zero.
   - Two-line caption: «Денег на счетах хватает до … / на все выплаты» and «Пик выплат: … KZT, неделя … – … · всего …». All numbers are real; nothing invented.
   - Axis labels, legend and captions live in HTML (not in the SVG) so the chart scales cleanly at 1440 / 1280 and degrades to 390 px (axis thins to 3 labels on phones). Card bounded at 820 px, one accent (`--v2-viz-a`), tabular numbers, thin strokes, no gridlines. Bars have hover `<title>` tooltips.
   - Empty states: no cash and no payouts → calm line «заполните остаток на счетах в Настройках» with link to `/settings#opening_cash`; cash unknown but payouts present → bars only with an honest caption; cash known, no payouts → flat line + caption.

2. **/skus — hover image preview** (`src/components/v2/SkuIndex.tsx`, `src/components/v2/ui.module.css`)
   - `Thumb` keeps the 28 px thumbnail; hover or keyboard focus floats a 300 px (min with 80vw / 70vh) white card with radius, shadow and 120 ms fade, positioned to the right of the thumbnail (falls to the left when there is no room) and clamped inside the viewport. `position: fixed`, `pointer-events: none`, no layout shift; closes on scroll. Touch: tap toggles the preview without navigating.
   - Reuses the `image_url` already produced by `skuImageUrl` in `/api/skus`; no new component and no new dependency.

3. **/money — compact centred hero metrics** (`src/app/(v2)/money/MoneyPage.tsx`, `src/app/(v2)/money/money.module.css`)
   - The four hero metrics are wrapped in `.hero`: centred group, `max-width: 960px`, `margin: 0 auto`, bordered card with four equal cells, centred label (13 px muted) and value (30 px tabular, 28 px under 900 px, 24 px on phones), 2×2 grid under 900 px. «Заполнить» / «Где взять» links from UX-FIX-B are untouched (they render inside the same cells).
   - Shared `Kpis` component in `ui.tsx` is unchanged; the override uses a doubled class selector to beat the shared `.kpi + .kpi` rules without touching other pages.

## Checks

- `npx tsc --noEmit` (via the local TypeScript binary): clean, no errors.
- `npm run check`: `passed=321 failed=0 skipped=7 externally-unverified=7` (main at the same moment: 325/0/7 — the delta is run-to-run count variance of the suite, not a failure).
- `npm run build`: the worktree has no `node_modules` or `data/` of its own; both were linked from the main checkout for the checks (untracked, not committed). Turbopack rejects a symlinked `node_modules` («points out of the filesystem root»), so the build was run as `next build --webpack`: `✓ Compiled successfully in 4.7s`; the subsequent TypeScript step reports only the two stale `.next/types` route-export errors (`api/params` → `paramsView`, `api/voice/session` → `REALTIME_MODEL`), which are unchanged from main (this lane touches no `src/app/api` file) and are the errors the brief says to ignore.

## Left / not done

- Nothing from the brief is left out. Hover tooltips on the cash line itself were optional and not added (bars have them).
- Visual check at 1280 / 1440 / 390 px was reasoned from CSS, not screenshot-verified in a browser within the 12:12Z window.

## Files changed

- `src/app/(v2)/today/page.tsx`
- `src/app/(v2)/today/today.module.css`
- `src/app/(v2)/money/MoneyPage.tsx`
- `src/app/(v2)/money/money.module.css`
- `src/components/v2/SkuIndex.tsx`
- `src/components/v2/ui.module.css`
- `docs/agent_handoffs/UX_FIX_D_CLOSEOUT.md`

Gate: GREEN — tsc clean, check 321/0, build compiled; only pre-existing `.next/types` errors remain, out of this lane's scope.
