# Opus A · Astra interface pass

Baseline: `da810b1` (fast-forward from main into lane/opus_a). Scope: Today, Replenishment, SKU and their shared Opus A shell. Next 16.3.6, React 19, existing scoped CSS/tokens and lucide icons. Authority: owner brief, AGENTS.md, docs/CONTRACTS.md. Local partner database; no external writes.

Design context: purchasing manager, repeated daily review of supplier quantities and stock risk. Outcome: inspect evidence, adjust a specific recommendation, prepare/approve the exact order and download its 1C file without losing place. Trust failure: stale quantities approved as current, unknown prices presented as a complete total, or unavailable actions presented as saved. Evidence, not number of new controls, is acceptance. STOP: outside-scope edits, conflicting ownership, external writes.

Craft contract: preserve greige canvas, chartreuse primary, display headings, status pills, two-line goods identity, hairlines and right-aligned tabular money. Ramp for operational hierarchy; Stripe for exact quantities and price coverage; Linear for keyboard/context. On phone, readable stacked goods rows and full-width rationales; recommendation before supporting history. Motion remains quiet and respects reduced motion. Design-taste's landing-page prescriptions are outside this operational surface's scope.

References viewed: Ramp Bill_pay 00.26.25 and 00.26.28; banking 00.35.26 and 00.35.50; accounting 00.42.01; Pay_intake 00.46.07 (2026-09-11 PNGs). Baseline screenshots: `before-{today,replenishment,sku}-{desktop,phone}.png`, 1440×900 and 390×844.

| Severity | Domain | Location at baseline | Before | Intended fix | Why |
| --- | --- | --- | --- | --- | --- |
| HIGH | Accessibility/layout | ui.css:190, :233, :276 | Phone navigation/tabs and 720px table require sideways scrolling; rationale constrained inside wide table | Fit navigation and filters; transform table into labelled stacked rows | Controls and quantity must be reachable at phone width |
| HIGH | Typography | ui.css:217; Replenishment.tsx:60 | Truncated goods names have no direct full-name/detail path | Full name in rationale with SKU link; two-line identity | Similar goods must be distinguishable |
| HIGH | Layout | ui.css:94 | 67,763,248 ₸ crosses a phone metric cell | Responsive money size and wrapping at unit boundary | Prevent numeric overlap |
| HIGH | Writing/states | Shell.tsx:27 | Failed and empty searches silently disappear | Loading, no match and retry states tied to the current query | Failure must have a recovery |
| HIGH | State integrity | Replenishment.tsx:20–38 | Background-loaded SKU version can advance while an old row is edited | Freeze matching recommendation ID/version on explicit edit; block stale replay | Submit exactly the reviewed object |
| MEDIUM | Workflow | Replenishment.tsx:103; SkuCard.tsx:29 | Back links discard list filters/position; change quantity opens entire supplier | Persist list view/scroll; direct item-specific edit path | Avoid repeating searches |
| MEDIUM | Accessibility | Shell.tsx:40; Replenishment.tsx:142 | Search options are mouse-down driven; tabs lack composite keys; j/k absent | Native links, correct combobox keys, roving filter tabs and row keys | Complete keyboard path |
| MEDIUM | Hierarchy/writing | Replenishment.tsx:136 | Long formula paragraph consumes phone first screen | Short task instruction; keep calculation inside rationale | Bring actual goods into view |
| MEDIUM | Features/truth | Today.tsx:187; SkuCard.tsx:34 | Export sends user out of lane; no calculation time/history; available image omitted | Quiet order receipt/export and run controls; conditional thumbnails | Complete daily work in context |
| MEDIUM | Accessibility | ui.css:175 | Shimmer ignores reduced motion | Disable shimmer and movement when requested | Respect motion preference |

All six better-* domains inspected in code and rendered baseline. Contrast measured during verification; screen-reader hardware walk is not available. EKT absent in the merged API snapshot; only render it when a supplied field exists. Adjustment POST absent at baseline; never simulate a saved quantity.

## Implemented and verified

The baseline defects above are fixed. Replenishment has labelled phone rows, wrapping full identity in the rationale, preserved supplier/filter/tab/disclosure/scroll, roving tabs and arrow/j/k row navigation. Search uses real code/article/name results with visible loading, empty and retry states; Enter opens the active result and Esc returns to the input. Both list and SKU expose the actual availability of adjustment before offering an editor. The editor binds recommendation ID/version at explicit review; a 409 blocks replay and refresh preserves the manager's draft quantity/reason.

Today separates proposal preparation, draft approval and export. Approval is version bound; successful API acknowledgment updates the card immediately while the rest of the dashboard refreshes. Approved CSV and XLSX downloads were parsed to verify the literal header `Код 1с` and unchanged SKU codes. Partial prices are labelled, and entirely unknown totals display a dash. The shell and Today now share one typed API snapshot, removing duplicate expensive reads. Run history shows the last timestamp and five runs. `Пересчитать всё` deliberately performs a complete run: the current backend returns only the latest run, so a supplier-only recalculation hides other suppliers. No backend was changed.

Conditional 28px product images occupy space only when present. EKT price, currency, stock, as-of and source are conditional on the top-level field. Latin Ainalym and the supplied SVG mark are retained. Greige surfaces, chartreuse primary, display scale, hairlines, pills and right-aligned tabular amounts remain the established language.

Additional verification found and fixed: a 6px navigation overflow at 320px; focus loss after a 409; duplicate full-card links in a rationale; delayed approved-state feedback; muted text contrast of 4.04:1 on the rail. Final measured text pairs are 4.55:1–15.70:1 (contrast.json). Motion respects reduced-motion; phone controls checked at >=44px; input text uses 16px. Native links, labels, buttons and disclosures retain normal Tab order.

## Evidence map

- Compare `before-{today,replenishment,sku}-{desktop,phone}.png` with `after-{today,replenishment,sku}-{desktop,phone}.png`; additional `-full.png` versions expose below-fold content. Desktop 1440×900, phone 390×844.
- `rationale-*`, `adjust-unavailable-*`, `proposal-confirm-*`, `proposal-stale-*`, `approved-order-*`: real-data flows and controlled conflicts at both viewports.
- `search-{results,empty,unavailable}-desktop.png`, `replenishment-filter-empty.png`, `focus-phone-320.png`, `run-history-desktop.png`: keyboard, filtering, narrow reflow and calculation history.
- `{today,replenishment,sku}-{loading,unavailable}-{desktop,phone}.png`, `replenishment-empty-*`, `sku-no-recommendation-*`, `sku-not-found-phone.png`: deterministic state matrix. Screenshots whose names contain `contract` use explicitly mocked adjustment or EKT responses; they do not prove live services exist.
- `order-stale-desktop.png`: approval binds the reviewed version and 409 disables repeat submission. `playwright-results.json` is the final run; the nested `docs/.../playwright-results.json` is an intermediate failed-run artifact retained for provenance. `1/` contains preliminary SKU comparison crops.
- `INDEPENDENT_REVIEW.md` contains the fresh Sol review and subsequent rechecks; its initial RED findings led to removal of misleading edit affordances and correction of proposal/approval copy.

## Acceptance boundaries

Root acceptance is recorded in OPUS_A_ASTRA_1_CLOSEOUT.md. TypeScript, build and scoped ESLint pass. `npm run check`: 227 pass, 0 fail, 6 skipped, 6 externally unverified, unchanged baseline limitation. Build retains existing middleware-deprecation and dynamic-filesystem-tracing warnings. No runtime dependencies were added. Only local anonymised test orders/calculations were mutated; no supplier message or external write occurred.

The absent adjustment endpoint is explicitly unavailable as allowed by the owner; save/409 behavior is covered with contract fixtures. EKT is absent in this merged API and covered conditionally with its adjacent lane's schema. Hardware screen-reader and Safari checks were not run. Task review pages outside `/opus_a/*` remain outside this pass. No claim of production readiness or final design selection is made.

Craft rubric (0–4, bounded to this pass): task hierarchy 3.5; layout/reflow 3.5; typography/numbers 3.5; color/contrast 3.5; interaction/state integrity 3.5; RU copy/truth 3.5. Strongest remaining limitation: backend execution time grows with repeated local runs; the UI now avoids duplicate Today requests but does not change that backend query.

Final disposition: YELLOW at the owner’s 40-minute cap. The broad run finished with 11 passed and 3 failed; the integration rerun finished with 2 failed. Both had exited before the deadline-stop signal. ACCEPTANCE.json records actual counts. The added phone state matrix did not finish its SKU/empty captures, but the final order-conflict check and capture passed; do not interpret the evidence-map patterns above as proof every cross-product file exists. Populated before/after pairs, both proposal conflicts, adjustment contract, search, preserved context, 320px controls and desktop state matrix passed. The corrected complete-run assertion and repeat export need a fresh isolated ETL fixture rerun. All npm/type/build gates pass.
