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
