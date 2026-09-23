# TODAY-CHART closeout — two-ring «Склад и деньги на 60 дней» on /today

Lane: `lane/today_chart` (cut from main 8d00ac4). Owner verdict D-H77: the 60-day outlook bar/line chart felt awkward because it was almost empty on the demo data.

## What changed
- `src/app/(v2)/today/page.tsx` — the `Outlook` SVG block (weekly bars + cash line, 9-week axis, legend) is replaced by two inline SVG donuts (stroke-dasharray, no library):
  - Ring 1 «Склад в деньгах» — stock value at cost in the centre; the ring is split into the share of stock with a known cost vs positions without a price (`pulse.money.stock_value.cost_known_share`); three-item legend: amount at cost, positions without a price, positions under stockout risk (link to `/replenishment?urgency=critical`).
  - Ring 2 «Деньги на 60 дней» — covered share (cash ÷ supplier payouts due within 60 days) as a percentage in the centre; sub-label «до <date>» / «хватает» / «выплат нет»; legend: cash on hand, payouts due, «Не хватает N ₸» or «Останется N ₸». Danger accent when the cash runs out.
  - When cash or cost is unknown, the ring is replaced by a calm «Заполните в Настройках» link (never a broken shape).
  - Two-line plain-language caption under the rings (money outcome + stock summary).
- `src/app/(v2)/today/today.module.css` — old chart rules removed; card ≈ 760 px max, two rings side by side (`.rings` grid), single column with 148 px rings at ≤ 640 px; accents: ring 1 `--v2-ink`, ring 2 `--v2-viz-a`, shortfall `--v2-danger`, track `--v2-line`; tabular numbers.
- Nothing else touched. Data: only `/api/today` snapshot (already loaded) and `/api/money` (already loaded).

## Deviation (named, not hidden)
The brief asked for ring 1 to split stock value by urgency (Срочно / На неделе / В порядке). No loaded view (`/api/today`, `/api/money`) carries a per-urgency money figure — `stockout_risk` exposes only a count and a top-5 list without amounts. Adding it would require a domain change in `src/domain/cashflow.ts` (out of this lane's scope). Ring 1 therefore splits by what the data proves (cost known / no price) and carries the stockout-risk count as the third legend item. Next route: extend `stock_value` with `by_urgency: { critical, soon, ok }` in the cashflow view, then swap the two segments for three (`segs` array is already shape-agnostic).

## Checks
- `npx tsc --noEmit` — clean (stale `.next/types` errors ignored per brief).
- `npm run check` — passed=335 failed=0 skipped=7 externally-unverified=7 (GREEN).
- `npm run build` — passed; `/today` prerendered.

## Demo-data note
`scripts/demo_reset.mjs` seeds the partner org with `opening_cash: []`, so after a fresh reset ring 2 shows the calm «Заполните в Настройках» link until an opening balance is entered in Settings (the previous chart had the same gap). Ring 1 is always filled on the demo (stock at cost 144 117 720 ₸, 13 % with known cost, 3 083 positions without a price). Seeding a demo balance is a one-line change in `demo_reset.mjs`, outside this lane's scope.

Gate: GREEN
